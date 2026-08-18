import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatConvKind, ChatMessage, ChatMsgStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ChatConversationEvent,
  ChatMessageCreatedEvent,
  ChatMessageDeletedEvent,
  ChatMessageEditedEvent,
  ChatReadEvent,
  RT_EVENTS,
} from '../../common/events/realtime-events';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { CreateCitizenConversationDto } from './dto/create-citizen-conversation.dto';
import { ListChatMessagesQueryDto } from './dto/list-chat-messages-query.dto';
import { ChatConversationResponse } from './interfaces/chat-conversation-response.interface';

/** The admin operator's sender id — mirrors `ME_ID` in web-admin's chat store. */
const ME_ID = 'me';

/** The single group conversation — cannot be cleared or deleted. */
const GROUP_ID = 'group-all';

const DEFAULT_MESSAGES_LIMIT = 50;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Conversation list, each annotated with its last message and unread count
   * — mirrors what web-admin's `ChatPage` used to derive client-side from
   * the full in-store message array (`shared/store/chat.ts`).
   *
   * @param archived  false/undefined ⇒ main list (non-archived); true ⇒ Archive view.
   */
  async findAllConversations(archived = false): Promise<ChatConversationResponse[]> {
    const [conversations, unreadRows] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where: { archived },
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.chatMessage.groupBy({
        by: ['conversationId'],
        where: { senderId: { not: ME_ID }, status: { not: ChatMsgStatus.read } },
        _count: { _all: true },
      }),
    ]);

    const unreadByConversation = new Map(
      unreadRows.map((row) => [row.conversationId, row._count._all]),
    );

    return conversations.map(({ messages, ...conversation }) => ({
      ...conversation,
      lastMessage: messages[0] ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }));
  }

  /** Chronological (ascending) page of messages, newest `limit` before the `before` cursor. */
  async findMessages(
    conversationId: string,
    query: ListChatMessagesQueryDto,
  ): Promise<ChatMessage[]> {
    await this.ensureConversation(conversationId);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? DEFAULT_MESSAGES_LIMIT,
    });

    return messages.reverse();
  }

  async sendMessage(
    conversationId: string,
    dto: CreateChatMessageDto,
  ): Promise<ChatMessage> {
    await this.ensureConversation(conversationId);

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: dto.senderId ?? ME_ID,
        kind: dto.kind,
        text: dto.text,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        url: dto.url,
        durationSec: dto.durationSec,
        status: ChatMsgStatus.sent,
      },
    });

    // A new message un-archives the thread (activity brings it back to the
    // main list) and bumps its updatedAt for list ordering.
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { archived: false, archivedAt: null },
    });

    this.events.emit(RT_EVENTS.messageCreated, {
      conversationId,
      message,
    } satisfies ChatMessageCreatedEvent);

    return message;
  }

  /**
   * Opens (or re-opens) a 1:1 conversation with an employee — upserted by a
   * deterministic id (`dm-emp-<employeeId>`) so repeated calls for the same
   * employee are idempotent and always resolve to the same conversation.
   */
  async openDirectConversation(
    dto: CreateDirectConversationDto,
  ): Promise<ChatConversationResponse> {
    const id = `dm-emp-${dto.employeeId}`;

    const conversation = await this.prisma.chatConversation.upsert({
      where: { id },
      create: {
        id,
        kind: ChatConvKind.direct,
        title: dto.title,
        avatarColor: dto.avatarColor,
        staffId: dto.employeeId,
        online: false,
      },
      // Opening a conversation also restores it from Archive.
      update: {
        title: dto.title,
        archived: false,
        archivedAt: null,
        ...(dto.avatarColor !== undefined ? { avatarColor: dto.avatarColor } : {}),
      },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    return this.withUnreadCount(conversation);
  }

  /**
   * Opens (or re-opens) a 1:1 conversation with an app-user (fuqaro) —
   * upserted by a deterministic id (`dm-citizen-<appUserId>`), mirroring the
   * employee DM path so admin↔citizen messaging shares the same chat plumbing.
   */
  async openCitizenConversation(
    dto: CreateCitizenConversationDto,
  ): Promise<ChatConversationResponse> {
    const id = `dm-citizen-${dto.appUserId}`;

    const conversation = await this.prisma.chatConversation.upsert({
      where: { id },
      create: {
        id,
        kind: ChatConvKind.direct,
        title: dto.title,
        avatarColor: dto.avatarColor,
        staffId: dto.appUserId,
        online: false,
      },
      // Opening a conversation also restores it from Archive.
      update: {
        title: dto.title,
        archived: false,
        archivedAt: null,
        ...(dto.avatarColor !== undefined ? { avatarColor: dto.avatarColor } : {}),
      },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    return this.withUnreadCount(conversation);
  }

  /** Marks every message NOT sent by "me" as read (mirrors the store's `markRead`). */
  async markRead(conversationId: string, readerId = ME_ID): Promise<{ ok: true }> {
    await this.ensureConversation(conversationId);

    await this.prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: readerId },
        status: { not: ChatMsgStatus.read },
      },
      data: { status: ChatMsgStatus.read },
    });

    this.events.emit(RT_EVENTS.read, {
      conversationId,
      readerId,
    } satisfies ChatReadEvent);

    return { ok: true };
  }

  /** Archive / unarchive a conversation (keeps messages). */
  async archiveConversation(
    id: string,
    archived: boolean,
  ): Promise<ChatConversationResponse> {
    await this.ensureConversation(id);

    const conversation = await this.prisma.chatConversation.update({
      where: { id },
      data: { archived, archivedAt: archived ? new Date() : null },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    this.emitConversationEvent(id, archived ? 'archived' : 'unarchived', conversation.staffId);
    return this.withUnreadCount(conversation);
  }

  /**
   * "Clear chat" (tozalash): delete every message, then auto-archive the
   * conversation. The group conversation cannot be cleared.
   */
  async clearConversation(id: string): Promise<{ ok: true }> {
    await this.ensureConversation(id);
    this.assertNotGroup(id, 'clear');

    const conversation = await this.prisma.chatConversation.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });
    await this.prisma.chatMessage.deleteMany({ where: { conversationId: id } });

    this.emitConversationEvent(id, 'cleared', conversation.staffId);
    return { ok: true };
  }

  /** Permanently delete a conversation and its messages (group is protected). */
  async deleteConversation(id: string): Promise<{ ok: true }> {
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id } });
    if (!conversation) {
      throw new NotFoundException(`Chat conversation ${id} not found`);
    }
    this.assertNotGroup(id, 'delete');

    // Messages cascade via the onDelete: Cascade relation.
    await this.prisma.chatConversation.delete({ where: { id } });

    this.emitConversationEvent(id, 'deleted', conversation.staffId);
    return { ok: true };
  }

  /** Delete a single message. */
  async deleteMessage(conversationId: string, messageId: string): Promise<{ ok: true }> {
    const message = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    await this.prisma.chatMessage.delete({ where: { id: messageId } });

    this.events.emit(RT_EVENTS.messageDeleted, {
      conversationId,
      messageId,
    } satisfies ChatMessageDeletedEvent);

    return { ok: true };
  }

  /** Edit a message body — allowed only while it is still unread. */
  async editMessage(
    conversationId: string,
    messageId: string,
    text: string,
  ): Promise<ChatMessage> {
    const existing = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!existing) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    if (existing.status === ChatMsgStatus.read) {
      throw new ConflictException("O'qilgan xabarni tahrirlab bo'lmaydi");
    }

    const message = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
    });

    this.events.emit(RT_EVENTS.messageEdited, {
      conversationId,
      message,
    } satisfies ChatMessageEditedEvent);

    return message;
  }

  private assertNotGroup(id: string, action: string): void {
    if (id === GROUP_ID) {
      throw new BadRequestException(`Umumiy chatni ${action} qilib bo'lmaydi`);
    }
  }

  private emitConversationEvent(
    conversationId: string,
    action: ChatConversationEvent['action'],
    staffId: string | null,
  ): void {
    this.events.emit(RT_EVENTS.conversation, {
      conversationId,
      action,
      staffId,
    } satisfies ChatConversationEvent);
  }

  private async ensureConversation(id: string): Promise<void> {
    const exists = await this.prisma.chatConversation.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Chat conversation ${id} not found`);
    }
  }

  /**
   * Shapes a single conversation (with its latest message preloaded) into a
   * {@link ChatConversationResponse} — same derived fields `findAllConversations`
   * computes in bulk, kept in one place so single-conversation call sites
   * don't drift from the list's shape.
   */
  private async withUnreadCount(
    conversation: { messages: ChatMessage[] } & Omit<
      ChatConversationResponse,
      'lastMessage' | 'unreadCount'
    >,
  ): Promise<ChatConversationResponse> {
    const { messages, ...rest } = conversation;
    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        conversationId: rest.id,
        senderId: { not: ME_ID },
        status: { not: ChatMsgStatus.read },
      },
    });

    return { ...rest, lastMessage: messages[0] ?? null, unreadCount };
  }
}
