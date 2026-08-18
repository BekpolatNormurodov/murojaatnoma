import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppConfig } from '../../common/config/configuration';
import {
  ChatConversationEvent,
  ChatMessageCreatedEvent,
  ChatMessageDeletedEvent,
  ChatMessageEditedEvent,
  ChatReadEvent,
  RT_EVENTS,
} from '../../common/events/realtime-events';
import { JwtPayload } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushService } from '../push/push.service';
import { ChatService } from '../chat/chat.service';
import { CallsService } from './calls.service';
import { RealtimeService } from './realtime.service';
import { CallMedia, SocketIdentity } from './interfaces/socket-identity.interface';

const ADMIN_ID = 'me';
const DM_PREFIX = 'dm-emp-';

/**
 * Single Socket.IO gateway for BOTH live chat and WebRTC call signaling
 * (see docs/superpowers/specs/2026-08-18-realtime-chat-calls-contract.md).
 * Handshake carries a JWT (auth.token); the socket is bound to `user:<id>`
 * and, on demand, to `conv:<conversationId>` rooms. Chat mutations are
 * persisted by ChatService which emits domain events; this gateway re-emits
 * them to the right rooms so REST and socket callers both fan out live.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly presence: RealtimeService,
    private readonly calls: CallsService,
    private readonly push: PushService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------
  async handleConnection(client: Socket): Promise<void> {
    try {
      const identity = await this.resolveIdentity(client);
      client.data.identity = identity;
      await client.join(`user:${identity.id}`);
      const newlyOnline = this.presence.addSocket(identity.id, client.id);
      if (newlyOnline) {
        this.broadcastPresence(identity.id, true);
        await this.mirrorConversationOnline(identity, true);
      }
      // Give the client the current online roster so it can paint dots immediately.
      client.emit('presence:snapshot', { online: this.presence.onlineUserIds() });
    } catch (err) {
      this.logger.warn(
        `Rejecting socket ${client.id}: ${err instanceof Error ? err.message : 'unauthorized'}`,
      );
      client.emit('connect_error', { message: 'unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const identity = this.identityOf(client);
    if (!identity) return;
    await this.endCallsFor(identity.id);
    const nowOffline = this.presence.removeSocket(identity.id, client.id);
    if (nowOffline) {
      this.broadcastPresence(identity.id, false);
      await this.mirrorConversationOnline(identity, false);
    }
  }

  private async resolveIdentity(client: Socket): Promise<SocketIdentity> {
    const rawAuth = client.handshake.auth as { token?: unknown } | undefined;
    const header = client.handshake.headers.authorization;
    const token =
      (typeof rawAuth?.token === 'string' && rawAuth.token) ||
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new Error('missing token');

    const secret = this.config.get('jwt', { infer: true }).accessSecret;
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
    const scope = payload.scope ?? 'employee';

    if (scope === 'admin') {
      return { id: ADMIN_ID, name: payload.username ?? 'Administrator', scope: 'admin' };
    }
    if (scope === 'citizen') {
      throw new Error('citizens cannot use realtime');
    }
    const emp = await this.prisma.employee.findUnique({
      where: { id: payload.sub },
      select: { fullName: true, avatarUrl: true },
    });
    return {
      id: payload.sub,
      name: emp?.fullName ?? 'Xodim',
      avatar: emp?.avatarUrl ?? undefined,
      scope: 'employee',
    };
  }

  // ---------------------------------------------------------------------------
  // Chat — client → server
  // ---------------------------------------------------------------------------
  @SubscribeMessage('chat:join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    void client.join(`conv:${body.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    void client.leave(`conv:${body.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      conversationId: string;
      kind: 'text' | 'image' | 'file' | 'voice';
      text?: string;
      fileName?: string;
      fileSize?: number;
      url?: string;
      durationSec?: number;
    },
  ) {
    const identity = this.requireIdentity(client);
    const message = await this.chat.sendMessage(body.conversationId, {
      senderId: identity.id,
      kind: body.kind,
      text: body.text,
      fileName: body.fileName,
      fileSize: body.fileSize,
      url: body.url,
      durationSec: body.durationSec,
    });
    return { ok: true, message };
  }

  @SubscribeMessage('chat:read')
  async onRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const identity = this.requireIdentity(client);
    await this.chat.markRead(body.conversationId, identity.id);
    return { ok: true };
  }

  @SubscribeMessage('chat:typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ) {
    const identity = this.requireIdentity(client);
    client.to(`conv:${body.conversationId}`).emit('chat:typing', {
      conversationId: body.conversationId,
      userId: identity.id,
      isTyping: !!body.isTyping,
    });
  }

  @SubscribeMessage('chat:delete-message')
  async onDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; messageId: string },
  ) {
    this.requireIdentity(client);
    await this.chat.deleteMessage(body.conversationId, body.messageId);
    return { ok: true };
  }

  @SubscribeMessage('chat:edit-message')
  async onEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; messageId: string; text: string },
  ) {
    this.requireIdentity(client);
    const message = await this.chat.editMessage(body.conversationId, body.messageId, body.text);
    return { ok: true, message };
  }

  // ---------------------------------------------------------------------------
  // Chat — domain events (from ChatService, REST or socket path) → rooms
  // ---------------------------------------------------------------------------
  @OnEvent(RT_EVENTS.messageCreated)
  broadcastMessage(e: ChatMessageCreatedEvent): void {
    this.toConversation(e.conversationId).emit('chat:message', e);
  }

  @OnEvent(RT_EVENTS.messageDeleted)
  broadcastMessageDeleted(e: ChatMessageDeletedEvent): void {
    this.toConversation(e.conversationId).emit('chat:message:deleted', e);
  }

  @OnEvent(RT_EVENTS.messageEdited)
  broadcastMessageEdited(e: ChatMessageEditedEvent): void {
    this.toConversation(e.conversationId).emit('chat:message:edited', e);
  }

  @OnEvent(RT_EVENTS.read)
  broadcastRead(e: ChatReadEvent): void {
    this.toConversation(e.conversationId).emit('chat:read', e);
  }

  @OnEvent(RT_EVENTS.conversation)
  broadcastConversation(e: ChatConversationEvent): void {
    const rooms = [`conv:${e.conversationId}`, `user:${ADMIN_ID}`];
    if (e.staffId) rooms.push(`user:${e.staffId}`);
    this.server.to(rooms).emit('chat:conversation', {
      conversationId: e.conversationId,
      action: e.action,
    });
  }

  // ---------------------------------------------------------------------------
  // Calls — WebRTC signaling relay
  // ---------------------------------------------------------------------------
  @SubscribeMessage('call:invite')
  async onCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { toUserId: string; media: CallMedia; conversationId?: string },
  ) {
    const from = this.requireIdentity(client);
    const toUserId = body.toUserId;
    const media: CallMedia = body.media === 'video' ? 'video' : 'audio';
    const calleeName = await this.nameOf(toUserId);

    if (this.calls.isBusy(toUserId)) {
      const busy = await this.calls.record(
        { callerId: from.id, callerName: from.name, calleeId: toUserId, calleeName, media },
        'busy',
      );
      client.emit('call:busy', { callId: busy.id });
      return { callId: busy.id, busy: true };
    }

    const call = await this.calls.createCall({
      callerId: from.id,
      callerName: from.name,
      calleeId: toUserId,
      calleeName,
      media,
    });
    call.ringTimeout = setTimeout(() => {
      void this.onRingTimeout(call.callId);
    }, this.ringMs());

    if (this.presence.isOnline(toUserId)) {
      this.server.to(`user:${toUserId}`).emit('call:incoming', {
        callId: call.callId,
        from: { id: from.id, name: from.name, avatar: from.avatar },
        media,
      });
    } else {
      void this.pushIncoming(toUserId, from.name, media, call.callId);
    }
    return { callId: call.callId };
  }

  @SubscribeMessage('call:accept')
  async onCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    this.requireIdentity(client);
    const call = this.calls.get(body.callId);
    if (!call) return { ok: false };
    this.calls.clearRing(call);
    await this.calls.accept(body.callId);
    this.server.to(`user:${call.callerId}`).emit('call:accepted', { callId: body.callId });
    return { ok: true };
  }

  @SubscribeMessage('call:reject')
  async onCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    this.requireIdentity(client);
    const call = this.calls.get(body.callId);
    if (!call) return { ok: false };
    this.calls.clearRing(call);
    await this.calls.finish(body.callId, 'rejected');
    this.server.to(`user:${call.callerId}`).emit('call:rejected', { callId: body.callId });
    return { ok: true };
  }

  @SubscribeMessage('call:cancel')
  async onCallCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    this.requireIdentity(client);
    const call = this.calls.get(body.callId);
    if (!call) return { ok: false };
    this.calls.clearRing(call);
    await this.calls.finish(body.callId, 'cancelled');
    this.server.to(`user:${call.calleeId}`).emit('call:cancelled', { callId: body.callId });
    return { ok: true };
  }

  @SubscribeMessage('call:sdp')
  onCallSdp(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; description: unknown },
  ) {
    const other = this.calls.otherParty(body.callId, this.requireIdentity(client).id);
    if (other) {
      this.server
        .to(`user:${other}`)
        .emit('call:sdp', { callId: body.callId, description: body.description });
    }
  }

  @SubscribeMessage('call:ice')
  onCallIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; candidate: unknown },
  ) {
    const other = this.calls.otherParty(body.callId, this.requireIdentity(client).id);
    if (other) {
      this.server
        .to(`user:${other}`)
        .emit('call:ice', { callId: body.callId, candidate: body.candidate });
    }
  }

  @SubscribeMessage('call:media')
  onCallMedia(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; source: 'camera' | 'screen'; on: boolean },
  ) {
    const other = this.calls.otherParty(body.callId, this.requireIdentity(client).id);
    if (other) {
      this.server
        .to(`user:${other}`)
        .emit('call:media', { callId: body.callId, source: body.source, on: body.on });
    }
  }

  @SubscribeMessage('call:end')
  async onCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const identity = this.requireIdentity(client);
    const call = this.calls.get(body.callId);
    if (!call) return { ok: false };
    this.calls.clearRing(call);
    const durationSec = await this.calls.finish(body.callId, 'ended');
    const other = call.callerId === identity.id ? call.calleeId : call.callerId;
    this.server.to(`user:${other}`).emit('call:ended', { callId: body.callId, durationSec });
    return { ok: true };
  }

  private async onRingTimeout(callId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call || call.status !== 'ringing') return;
    await this.calls.finish(callId, 'missed');
    this.server.to(`user:${call.callerId}`).emit('call:missed', { callId });
    this.server.to(`user:${call.calleeId}`).emit('call:missed', { callId });
  }

  private async endCallsFor(userId: string): Promise<void> {
    for (const call of this.calls.activeFor(userId)) {
      this.calls.clearRing(call);
      const status = call.status === 'accepted' ? 'ended' : 'missed';
      const durationSec = await this.calls.finish(call.callId, status);
      const other = call.callerId === userId ? call.calleeId : call.callerId;
      this.server
        .to(`user:${other}`)
        .emit('call:ended', { callId: call.callId, durationSec });
    }
  }

  private async pushIncoming(
    calleeId: string,
    callerName: string,
    media: CallMedia,
    callId: string,
  ): Promise<void> {
    if (calleeId === ADMIN_ID) return; // admins are on the web, no device tokens
    try {
      await this.push.sendToEmployee(
        calleeId,
        callerName,
        media === 'video' ? "Video qo'ng'iroq" : "Ovozli qo'ng'iroq",
        { type: 'incoming_call', callId, callerName, media },
      );
    } catch {
      /* push disabled / no tokens — in-app ringing only */
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private identityOf(client: Socket): SocketIdentity | undefined {
    return client.data?.identity as SocketIdentity | undefined;
  }

  private requireIdentity(client: Socket): SocketIdentity {
    const identity = this.identityOf(client);
    if (!identity) throw new Error('unauthenticated socket');
    return identity;
  }

  /** Broadcast op targeting a conversation's open thread + both participant lists. */
  private toConversation(conversationId: string) {
    const rooms = [`conv:${conversationId}`, `user:${ADMIN_ID}`];
    if (conversationId.startsWith(DM_PREFIX)) {
      rooms.push(`user:${conversationId.slice(DM_PREFIX.length)}`);
    }
    return this.server.to(rooms);
  }

  private broadcastPresence(userId: string, online: boolean): void {
    const lastSeen = (online ? new Date() : this.presence.getLastSeen(userId) ?? new Date())
      .toISOString();
    this.server.emit('presence:update', { userId, online, lastSeen });
  }

  private async mirrorConversationOnline(
    identity: SocketIdentity,
    online: boolean,
  ): Promise<void> {
    if (identity.scope !== 'employee') return;
    await this.prisma.chatConversation
      .updateMany({ where: { id: `${DM_PREFIX}${identity.id}` }, data: { online } })
      .catch(() => undefined);
  }

  private async nameOf(userId: string): Promise<string> {
    if (userId === ADMIN_ID) return 'Administrator';
    const emp = await this.prisma.employee.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    return emp?.fullName ?? 'Xodim';
  }

  private ringMs(): number {
    return this.config.get('realtime', { infer: true }).ringTimeoutSec * 1000;
  }
}
