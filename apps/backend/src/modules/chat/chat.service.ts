import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatConvKind, ChatMessage, ChatMsgStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { ListChatMessagesQueryDto } from './dto/list-chat-messages-query.dto';
import { ChatConversationResponse } from './interfaces/chat-conversation-response.interface';

/** The admin operator's sender id — mirrors `ME_ID` in web-admin's chat store. */
const ME_ID = 'me';

const DEFAULT_MESSAGES_LIMIT = 50;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Conversation list, each annotated with its last message and unread count
   * — mirrors what web-admin's `ChatPage` used to derive client-side from
   * the full in-store message array (`shared/store/chat.ts`).
   */
  async findAllConversations(): Promise<ChatConversationResponse[]> {
    const [conversations, unreadRows] = await Promise.all([
      this.prisma.chatConversation.findMany({
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

    return this.prisma.chatMessage.create({
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
  }

  /**
   * Opens (or re-opens) a 1:1 conversation with an employee — upserted by a
   * deterministic id (`dm-emp-<employeeId>`) so repeated calls for the same
   * employee are idempotent and always resolve to the same conversation.
   * Used by both the "message an employee" entry points in web-admin (live
   * map + general chat picker) — same endpoint, same conversation.
   *
   * Intentionally decoupled: the title/avatar come straight from the
   * request body (the frontend already has them from the live employee
   * list) — this never queries the employee/workforce table.
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
      update: {
        title: dto.title,
        ...(dto.avatarColor !== undefined ? { avatarColor: dto.avatarColor } : {}),
      },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    return this.withUnreadCount(conversation);
  }

  /** Marks every message NOT sent by "me" as read (mirrors the store's `markRead`). */
  async markRead(conversationId: string): Promise<{ ok: true }> {
    await this.ensureConversation(conversationId);

    await this.prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: ME_ID },
        status: { not: ChatMsgStatus.read },
      },
      data: { status: ChatMsgStatus.read },
    });

    return { ok: true };
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
   * (e.g. `openDirectConversation`) don't drift from the list's shape.
   */
  private async withUnreadCount(
    conversation: { messages: ChatMessage[] } & Omit<ChatConversationResponse, 'lastMessage' | 'unreadCount'>,
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
