import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatConvKind, ChatMessage, ChatMsgKind, ChatMsgStatus } from '@prisma/client';
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

/** Deterministic id prefix of an admin↔employee DM (`dm-emp-<employeeId>`). */
const DM_PREFIX = 'dm-emp-';

/** A message plus who sent it — lets clients label group messages by person. */
export type ChatMessageWithSender = ChatMessage & {
  senderName: string;
  senderAvatar: string | null;
};

/** Call outcome as recorded by the realtime gateway (mirrors CallStatus). */
export interface ChatCallRecord {
  callId: string;
  callerId: string;
  calleeId: string;
  media: 'audio' | 'video';
  status: string;
  durationSec: number;
}

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
    if (conversations.some((c) => c.id === GROUP_ID)) {
      unreadByConversation.set(GROUP_ID, await this.groupUnreadFor(ME_ID));
    }

    return conversations.map(({ messages, ...conversation }) => ({
      ...conversation,
      lastMessage: messages[0] ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }));
  }

  // ---------------------------------------------------------------------------
  // Employee-facing (worker-app) — self-scoped subset of the chat module.
  // The class-level controller lock is @RequireScope('admin'); these are reached
  // only via method-level @RequireScope('employee') routes. Every one is bound
  // to the caller's own id so an employee can ONLY ever touch their own admin DM
  // (`dm-emp-<self>`) or the shared group thread — never another employee's or a
  // citizen's conversation. This is the deferred "broaden to employee" step,
  // done without re-opening the PII hole that locked the controller to admin.
  // ---------------------------------------------------------------------------

  /** The only two conversations an employee may see: the group + their own admin DM. */
  private employeeConversationIds(employeeId: string): string[] {
    return [GROUP_ID, `${DM_PREFIX}${employeeId}`];
  }

  /**
   * May `userId` touch `conversationId`? The admin ('me') sees everything; an
   * employee only the group + their own DM. Shared by the REST `/chat/my/*`
   * routes AND the realtime gateway (join/send/read/typing/edit/delete), so the
   * socket path cannot side-step the REST scoping.
   */
  canAccess(userId: string, conversationId: string): boolean {
    return userId === ME_ID || this.employeeConversationIds(userId).includes(conversationId);
  }

  /** Throw unless {@link canAccess}. */
  assertAccess(userId: string, conversationId: string): void {
    if (!this.canAccess(userId, conversationId)) {
      throw new ForbiddenException('Bu suhbatga ruxsat yo‘q');
    }
  }

  /**
   * Employee inbox: the group thread + the caller's own admin DM, each with its
   * last message and a reader-relative unread count. The DM is always listed —
   * if the admin never opened it, a not-yet-persisted placeholder is returned
   * and the first message (from either side) creates it. Archive is the admin's
   * view state, so it does not hide threads from the employee.
   */
  async findMyConversations(employeeId: string): Promise<ChatConversationResponse[]> {
    const dmId = `${DM_PREFIX}${employeeId}`;
    const [conversations, dmUnread, groupUnread] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where: { id: { in: this.employeeConversationIds(employeeId) } },
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.chatMessage.count({
        where: {
          conversationId: dmId,
          senderId: { not: employeeId },
          status: { not: ChatMsgStatus.read },
        },
      }),
      this.groupUnreadFor(employeeId),
    ]);

    const result: ChatConversationResponse[] = conversations.map(
      ({ messages, ...conversation }) => ({
        ...conversation,
        lastMessage: messages[0] ?? null,
        unreadCount: conversation.id === GROUP_ID ? groupUnread : dmUnread,
      }),
    );
    if (!result.some((c) => c.id === dmId)) {
      result.push({
        id: dmId,
        kind: ChatConvKind.direct,
        title: "Ma'muriyat",
        subtitle: null,
        avatarColor: null,
        photo: null,
        staffId: employeeId,
        online: false,
        archived: false,
        lastMessage: null,
        unreadCount: 0,
      });
    }
    return result;
  }

  /** Employee reads history of the group or their own DM (with sender names). */
  async findMyMessages(
    employeeId: string,
    conversationId: string,
    query: ListChatMessagesQueryDto,
  ): Promise<ChatMessageWithSender[]> {
    this.assertAccess(employeeId, conversationId);
    // Own DM not created yet (nobody has written) — empty history, not 404.
    if (!(await this.conversationExists(conversationId))) {
      return [];
    }
    return this.withSenders(await this.findMessages(conversationId, query));
  }

  /** Employee posts to the group or their own DM; senderId is forced server-side. */
  sendMyMessage(
    employeeId: string,
    conversationId: string,
    dto: CreateChatMessageDto,
  ): Promise<ChatMessageWithSender> {
    this.assertAccess(employeeId, conversationId);
    return this.sendMessage(conversationId, { ...dto, senderId: employeeId });
  }

  /** Employee marks the group or their own DM read (their own perspective). */
  async markMyRead(employeeId: string, conversationId: string): Promise<{ ok: true }> {
    this.assertAccess(employeeId, conversationId);
    if (!(await this.conversationExists(conversationId))) {
      return { ok: true };
    }
    return this.markRead(conversationId, employeeId);
  }

  /**
   * Group unread for one reader, from their own read cursor (see
   * `ChatReadCursor`). Without a cursor yet: the admin falls back to the legacy
   * status-based count (their past reads flipped status); an employee has
   * simply never read the group, so every message not sent by them counts.
   */
  private async groupUnreadFor(readerId: string): Promise<number> {
    const cursor = await this.prisma.chatReadCursor.findUnique({
      where: { conversationId_readerId: { conversationId: GROUP_ID, readerId } },
    });
    return this.prisma.chatMessage.count({
      where: {
        conversationId: GROUP_ID,
        senderId: { not: readerId },
        ...(cursor
          ? { createdAt: { gt: cursor.lastReadAt } }
          : readerId === ME_ID
            ? { status: { not: ChatMsgStatus.read } }
            : {}),
      },
    });
  }

  /** Attach `senderName`/`senderAvatar` ('me' → Ma'muriyat, else the employee). */
  async withSenders(messages: ChatMessage[]): Promise<ChatMessageWithSender[]> {
    const ids = [...new Set(messages.map((m) => m.senderId).filter((id) => id !== ME_ID))];
    const employees = ids.length
      ? await this.prisma.employee.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map(employees.map((e) => [e.id, e]));
    return messages.map((m) => {
      if (m.senderId === ME_ID) {
        return { ...m, senderName: "Ma'muriyat", senderAvatar: null };
      }
      const emp = byId.get(m.senderId);
      return { ...m, senderName: emp?.fullName ?? 'Xodim', senderAvatar: emp?.avatarUrl ?? null };
    });
  }

  /**
   * Write a finished admin↔employee call into their DM as a `kind: call` row,
   * so calls appear in both chat histories (web-admin + worker-app). Calls
   * between two employees have no chat thread and are only in `CallLog`.
   * Missed/cancelled rows stay unread for the callee (a "missed call" badge);
   * answered/rejected ones are born read.
   */
  async recordCall(call: ChatCallRecord): Promise<void> {
    let employeeId: string | null = null;
    if (call.callerId === ME_ID && call.calleeId !== ME_ID) employeeId = call.calleeId;
    else if (call.calleeId === ME_ID && call.callerId !== ME_ID) employeeId = call.callerId;
    if (!employeeId) return;

    const conversationId = `${DM_PREFIX}${employeeId}`;
    await this.ensureConversationForSend(conversationId);
    const unanswered = call.status === 'missed' || call.status === 'cancelled' || call.status === 'busy';
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: call.callerId,
        kind: ChatMsgKind.call,
        text: callLabel(call),
        durationSec: call.durationSec || null,
        status: unanswered ? ChatMsgStatus.sent : ChatMsgStatus.read,
        meta: {
          callId: call.callId,
          media: call.media,
          status: call.status,
          durationSec: call.durationSec,
        },
      },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { archived: false, archivedAt: null },
    });
    const [withSender] = await this.withSenders([message]);
    this.events.emit(RT_EVENTS.messageCreated, {
      conversationId,
      message: withSender,
    } satisfies ChatMessageCreatedEvent);
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
  ): Promise<ChatMessageWithSender> {
    if (dto.kind === ChatMsgKind.call) {
      // Call rows are written only by the gateway (recordCall) — never forged.
      throw new BadRequestException("Qo'ng'iroq yozuvini qo'lda yuborib bo'lmaydi");
    }
    await this.ensureConversationForSend(conversationId);

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

    const [withSender] = await this.withSenders([message]);
    this.events.emit(RT_EVENTS.messageCreated, {
      conversationId,
      message: withSender,
    } satisfies ChatMessageCreatedEvent);

    return withSender;
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

    // Group unread is per reader (ChatReadCursor); `status` below only drives
    // the senders' read ticks ("read by someone"), like Telegram groups.
    if (conversationId === GROUP_ID) {
      const now = new Date();
      await this.prisma.chatReadCursor.upsert({
        where: { conversationId_readerId: { conversationId, readerId } },
        create: { conversationId, readerId, lastReadAt: now },
        update: { lastReadAt: now },
      });
    }

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
  async deleteMessage(
    conversationId: string,
    messageId: string,
    actorId?: string,
  ): Promise<{ ok: true }> {
    const message = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    // An employee (actorId set) may only delete their own messages.
    if (actorId !== undefined && message.senderId !== actorId) {
      throw new ForbiddenException("Faqat o'z xabaringizni o'chira olasiz");
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
    actorId?: string,
  ): Promise<ChatMessage> {
    const existing = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!existing) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    // An employee (actorId set) may only edit their own messages.
    if (actorId !== undefined && existing.senderId !== actorId) {
      throw new ForbiddenException("Faqat o'z xabaringizni tahrirlay olasiz");
    }
    if (existing.kind === ChatMsgKind.call) {
      throw new BadRequestException("Qo'ng'iroq yozuvini tahrirlab bo'lmaydi");
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
    if (!(await this.conversationExists(id))) {
      throw new NotFoundException(`Chat conversation ${id} not found`);
    }
  }

  private async conversationExists(id: string): Promise<boolean> {
    return (await this.prisma.chatConversation.count({ where: { id } })) > 0;
  }

  /**
   * Like {@link ensureConversation}, but an admin↔employee DM that does not
   * exist yet is created on first write (either side may start it — the
   * employee no longer has to wait for the admin to open the thread).
   */
  private async ensureConversationForSend(id: string): Promise<void> {
    if (await this.conversationExists(id)) return;
    if (!id.startsWith(DM_PREFIX)) {
      throw new NotFoundException(`Chat conversation ${id} not found`);
    }
    const employeeId = id.slice(DM_PREFIX.length);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { fullName: true },
    });
    if (!employee) {
      throw new NotFoundException(`Chat conversation ${id} not found`);
    }
    await this.prisma.chatConversation.upsert({
      where: { id },
      create: {
        id,
        kind: ChatConvKind.direct,
        title: employee.fullName,
        staffId: employeeId,
        online: false,
      },
      update: {},
    });
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

/**
 * Human-readable, direction-neutral label for a call row — what older clients
 * (that don't know `kind: call`) show as plain text.
 */
function callLabel(call: ChatCallRecord): string {
  const what = call.media === 'video' ? "Video qo'ng'iroq" : "Ovozli qo'ng'iroq";
  if (call.durationSec > 0) {
    const m = Math.floor(call.durationSec / 60);
    const sec = String(call.durationSec % 60).padStart(2, '0');
    return `${what} · ${m}:${sec}`;
  }
  switch (call.status) {
    case 'missed':
      return `${what} · javob berilmadi`;
    case 'rejected':
      return `${what} · rad etildi`;
    case 'cancelled':
      return `${what} · bekor qilindi`;
    case 'busy':
      return `${what} · band`;
    default:
      return what;
  }
}
