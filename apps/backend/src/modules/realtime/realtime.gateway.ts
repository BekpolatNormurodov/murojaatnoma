import { randomUUID } from 'crypto';
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
import { MEDIA_UPDATED_EVENT, MediaUpdatedEvent } from '../media-monitor/media-monitor.service';
import { ChatService } from '../chat/chat.service';
import { CallsService } from './calls.service';
import { MeetingMeta, MeetingRoomService } from './meetings-room.service';
import { RealtimeService } from './realtime.service';
import { CallMedia, SocketIdentity } from './interfaces/socket-identity.interface';

const ADMIN_ID = 'me';
const DM_PREFIX = 'dm-emp-';
const GROUP_ID = 'group-all';

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
  /**
   * Users whose call teardown is deferred after their last socket dropped —
   * cancelled if they reconnect within the grace window. Socket.IO makes a NEW
   * socket on a cellular reconnect, so tearing calls down on every disconnect
   * kills a healthy P2P session on a 1-2s blip.
   */
  private readonly pendingCallTeardown = new Map<string, ReturnType<typeof setTimeout>>();
  private static readonly DISCONNECT_GRACE_MS = 10_000;
  /** A meeting nobody joined within this long after the invite is closed. */
  private static readonly MEETING_IDLE_MS = 2 * 60_000;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly presence: RealtimeService,
    private readonly calls: CallsService,
    private readonly meetings: MeetingRoomService,
    private readonly push: PushService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------
  async handleConnection(client: Socket): Promise<void> {
    try {
      const identity = await this.resolveIdentity(client);
      client.data.identity = identity;
      // A reconnect within the grace window keeps the live call alive.
      const pending = this.pendingCallTeardown.get(identity.id);
      if (pending) {
        clearTimeout(pending);
        this.pendingCallTeardown.delete(identity.id);
      }
      await client.join(`user:${identity.id}`);
      // Everyone who can use realtime (admin + employees; citizens are rejected
      // in resolveIdentity) listens on the shared group thread, so admin
      // broadcasts to "group-all" reach every connected employee live. Without
      // this, toConversation('group-all') targets only conv:group-all + user:me
      // and no employee is ever a member — group messages reached no one.
      await client.join(`conv:${GROUP_ID}`);
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
      // NB: 'connect_error' is a RESERVED Socket.IO event — emitting it from the
      // SERVER throws ("connect_error is a reserved event name"), which escaped
      // this catch and crash-looped the whole backend on every unauthorized
      // connect. Signal with a custom event instead, then disconnect.
      client.emit('auth:error', { message: 'unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const identity = this.identityOf(client);
    if (!identity) return;
    // Meeting cleanup is per-socket (keyed by client.id) — always run it.
    for (const meetingId of this.meetings.meetingsOf(client.id)) {
      await this.leaveMeeting(client, meetingId);
    }
    const nowOffline = this.presence.removeSocket(identity.id, client.id);
    if (nowOffline) {
      this.broadcastPresence(identity.id, false);
      await this.mirrorConversationOnline(identity, false);
      // Defer call teardown: a transient cellular reconnect spins up a NEW
      // socket ~1-2s later, so ending the call immediately would kill a healthy
      // session. Only tear down if the user is STILL offline after the grace
      // window (handleConnection cancels this timer on reconnect). While the
      // user has another live socket (multi-tab admin), nowOffline is false and
      // the call is never touched.
      const existing = this.pendingCallTeardown.get(identity.id);
      if (existing) clearTimeout(existing);
      this.pendingCallTeardown.set(
        identity.id,
        setTimeout(() => {
          this.pendingCallTeardown.delete(identity.id);
          if (!this.presence.isOnline(identity.id)) {
            void this.endCallsFor(identity.id);
          }
        }, RealtimeGateway.DISCONNECT_GRACE_MS),
      );
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
      const admin = await this.prisma.adminUser
        .findUnique({ where: { id: payload.sub }, select: { fullName: true } })
        .catch(() => null);
      return {
        id: ADMIN_ID,
        participantId: `admin:${payload.sub}`,
        name: admin?.fullName || payload.username || 'Administrator',
        scope: 'admin',
      };
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
      participantId: payload.sub,
      name: emp?.fullName ?? 'Xodim',
      avatar: emp?.avatarUrl ?? undefined,
      scope: 'employee',
    };
  }

  // ---------------------------------------------------------------------------
  // Chat — client → server
  // ---------------------------------------------------------------------------
  // Every chat event is scoped with ChatService.canAccess — the admin ('me')
  // reaches any thread, an employee only `group-all` + their own `dm-emp-<self>`
  // (same rule as the REST /chat/my/* routes, so the socket can't bypass it).
  @SubscribeMessage('chat:join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const identity = this.requireIdentity(client);
    if (!this.chat.canAccess(identity.id, body.conversationId)) {
      return { ok: false, error: 'forbidden' };
    }
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
    if (!this.chat.canAccess(identity.id, body.conversationId)) {
      return { ok: false, error: 'forbidden' };
    }
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
    if (!this.chat.canAccess(identity.id, body.conversationId)) {
      return { ok: false, error: 'forbidden' };
    }
    if (identity.scope === 'admin') {
      await this.chat.markRead(body.conversationId, identity.id);
    } else {
      // Tolerates the employee's not-yet-created DM (no-op instead of 404).
      await this.chat.markMyRead(identity.id, body.conversationId);
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ) {
    const identity = this.requireIdentity(client);
    if (!this.chat.canAccess(identity.id, body.conversationId)) return;
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
    const identity = this.requireIdentity(client);
    if (!this.chat.canAccess(identity.id, body.conversationId)) {
      return { ok: false, error: 'forbidden' };
    }
    // Admin moderates any message; an employee only their own.
    await this.chat.deleteMessage(
      body.conversationId,
      body.messageId,
      identity.scope === 'admin' ? undefined : identity.id,
    );
    return { ok: true };
  }

  @SubscribeMessage('chat:edit-message')
  async onEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; messageId: string; text: string },
  ) {
    const identity = this.requireIdentity(client);
    if (!this.chat.canAccess(identity.id, body.conversationId)) {
      return { ok: false, error: 'forbidden' };
    }
    const message = await this.chat.editMessage(
      body.conversationId,
      body.messageId,
      body.text,
      identity.scope === 'admin' ? undefined : identity.id,
    );
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

  /** OAV monitoringi found new items / wrote a new xulosa → admins' pages refresh live. */
  @OnEvent(MEDIA_UPDATED_EVENT)
  broadcastMediaUpdate(e: MediaUpdatedEvent): void {
    this.server.to(`user:${ADMIN_ID}`).emit('media:update', e);
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
    const identity = this.requireIdentity(client);
    const call = this.calls.get(body.callId);
    if (!call || call.calleeId !== identity.id) return { ok: false };
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
    const identity = this.requireIdentity(client);
    const call = this.calls.get(body.callId);
    if (!call || call.calleeId !== identity.id) return { ok: false };
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
    const identity = this.requireIdentity(client);
    const call = this.calls.get(body.callId);
    if (!call || call.callerId !== identity.id) return { ok: false };
    this.calls.clearRing(call);
    await this.calls.finish(body.callId, 'cancelled');
    this.server.to(`user:${call.calleeId}`).emit('call:cancelled', { callId: body.callId });
    void this.pushCallCancelled(call.calleeId, body.callId);
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
    if (!call || !this.calls.isParticipant(body.callId, identity.id)) return { ok: false };
    this.calls.clearRing(call);
    const durationSec = await this.calls.finish(body.callId, 'ended');
    const other = call.callerId === identity.id ? call.calleeId : call.callerId;
    this.server.to(`user:${other}`).emit('call:ended', { callId: body.callId, durationSec });
    void this.pushCallCancelled(other, body.callId);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Meetings — multi-party mesh WebRTC rooms (yig'ilish / guruh qo'ng'irog'i)
  // ---------------------------------------------------------------------------
  // Routing inside a meeting uses `participantId` (admins are `admin:<id>`), so
  // several admins and any number of employees each get their own peer.

  /**
   * Admin starts (or re-invites to) a meeting: everyone invited gets
   * `meeting:incoming` live, offline employees a push, and an "everyone" call
   * is announced in the group chat with a join button.
   */
  @SubscribeMessage('meeting:invite')
  async onMeetingInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      meetingId?: string;
      title?: string;
      media?: 'audio' | 'video';
      inviteeIds?: string[];
      all?: boolean;
      /** Ring people who were already invited too ("Hammani chaqirish" again). */
      ring?: boolean;
    },
  ) {
    const me = this.requireIdentity(client);
    if (me.scope !== 'admin') return { ok: false, error: 'forbidden' };
    const meetingId = sanitizeMeetingId(body.meetingId) ?? `m-${randomUUID().slice(0, 8)}`;
    const title = (body.title ?? '').trim().slice(0, 120) || "Guruh qo'ng'irog'i";
    const media = body.media === 'audio' ? 'audio' : 'video';

    const explicit = [...new Set((body.inviteeIds ?? []).filter((id) => typeof id === 'string'))];

    // Register the room BEFORE any await: the host's `meeting:join` is usually
    // emitted right behind this invite and must find the real title/host/invite
    // list (not open a default room that makes this invite look like a re-invite).
    const fresh = this.meetings.info(meetingId) === null;
    const prior = this.meetings.invitedOf(meetingId);
    const present = new Set(this.meetings.participants(meetingId).map((p) => p.id));
    this.meetings.open(meetingId, {
      title,
      media,
      hostId: me.participantId,
      hostName: me.name,
      invited: body.all ? 'all' : new Set(explicit),
    });

    const invitees = body.all
      ? (
          await this.prisma.employee.findMany({ where: { isActive: true }, select: { id: true } })
        ).map((e) => e.id)
      : explicit;
    // A second admin opening the same selektor must not re-ring everyone: on an
    // existing room only NEW invitees ring, unless the host asks to ring again.
    const toRing = invitees.filter(
      (id) =>
        !present.has(id) &&
        (fresh || body.ring || !(prior === 'all' || prior?.has(id))),
    );

    const incoming = {
      meetingId,
      title,
      media,
      host: { id: me.participantId, name: me.name },
      count: this.meetings.participants(meetingId).length,
    };
    for (const id of toRing) this.server.to(`user:${id}`).emit('meeting:incoming', incoming);
    void this.push
      .sendToEmployees(
        toRing.filter((id) => !this.presence.isOnline(id)),
        () => ({
          title,
          body: `${me.name} sizni ${media === 'video' ? 'video' : 'ovozli'} qo'ng'iroqqa chaqirmoqda`,
          data: { type: 'meeting_invite', meetingId, title, hostName: me.name, media },
        }),
      )
      .catch(() => undefined);

    if (fresh) {
      // Nobody ever entered (host closed the tab right after inviting) —
      // don't leave a phantom "live" meeting and ringing invitees behind.
      setTimeout(() => {
        const info = this.meetings.info(meetingId);
        if (!info || info.count > 0) return;
        const meta = this.meetings.end(meetingId);
        if (meta) void this.announceMeetingEnded(meetingId, meta, info.startedAt);
      }, RealtimeGateway.MEETING_IDLE_MS).unref?.();
    }

    if (body.all && fresh) {
      const messageId = await this.chat
        .postMeetingAnnouncement({ meetingId, title, media, hostName: me.name })
        .catch(() => null);
      if (messageId) this.meetings.setChatMessage(meetingId, messageId);
    }
    return { ok: true, meetingId, invited: toRing.length };
  }

  @SubscribeMessage('meeting:join')
  async onMeetingJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { meetingId: string; audio?: boolean; video?: boolean },
  ) {
    const me = this.requireIdentity(client);
    const meetingId = sanitizeMeetingId(body.meetingId);
    if (!meetingId) return { ok: false, error: 'bad-meeting' };
    if (!this.meetings.canJoin(meetingId, { id: me.participantId, scope: me.scope })) {
      return { ok: false, error: 'not-invited', participants: [] };
    }
    const self = {
      id: me.participantId,
      name: me.name,
      avatar: me.avatar,
      scope: me.scope,
      audio: body.audio !== false,
      video: body.video !== false,
    };
    const existing = this.meetings.join(meetingId, client.id, self);
    await client.join(`meeting:${meetingId}`);
    // Tell those already in the room that a newcomer arrived.
    client.to(`meeting:${meetingId}`).emit('meeting:participant-joined', {
      meetingId,
      participant: self,
    });
    // Ack the joiner with the existing participants (it mesh-offers to each).
    return {
      ok: true,
      selfId: me.participantId,
      meeting: this.meetings.info(meetingId),
      participants: existing,
    };
  }

  @SubscribeMessage('meeting:leave')
  async onMeetingLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { meetingId: string },
  ) {
    this.requireIdentity(client);
    await this.leaveMeeting(client, body.meetingId);
    return { ok: true };
  }

  /** Mic/camera state, broadcast so tiles show a real muted / camera-off badge. */
  @SubscribeMessage('meeting:media')
  onMeetingMedia(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { meetingId: string; audio: boolean; video: boolean },
  ) {
    const me = this.requireIdentity(client);
    const audio = body.audio !== false;
    const video = body.video !== false;
    if (!this.meetings.setMedia(body.meetingId, me.participantId, audio, video)) return { ok: false };
    client.to(`meeting:${body.meetingId}`).emit('meeting:media', {
      meetingId: body.meetingId,
      userId: me.participantId,
      audio,
      video,
    });
    return { ok: true };
  }

  /** Host or any admin ends the meeting for everyone. */
  @SubscribeMessage('meeting:end')
  async onMeetingEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { meetingId: string },
  ) {
    const me = this.requireIdentity(client);
    if (me.scope !== 'admin' && !this.meetings.isHost(body.meetingId, me.participantId)) {
      return { ok: false, error: 'forbidden' };
    }
    const info = this.meetings.info(body.meetingId);
    const meta = this.meetings.end(body.meetingId);
    if (!meta) return { ok: false };
    await this.announceMeetingEnded(body.meetingId, meta, info?.startedAt);
    this.server.in(`meeting:${body.meetingId}`).socketsLeave(`meeting:${body.meetingId}`);
    return { ok: true };
  }

  /** An invitee said no — the host sees it. */
  @SubscribeMessage('meeting:decline')
  onMeetingDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { meetingId: string },
  ) {
    const me = this.requireIdentity(client);
    const info = this.meetings.info(body.meetingId);
    if (!info) return { ok: false };
    for (const sid of this.meetings.socketsFor(body.meetingId, info.hostId)) {
      this.server.to(sid).emit('meeting:declined', {
        meetingId: body.meetingId,
        userId: me.participantId,
        name: me.name,
      });
    }
    return { ok: true };
  }

  /** Live meetings the caller may join (for "Qo'shilish" banners on reconnect). */
  @SubscribeMessage('meeting:active')
  onMeetingActive(@ConnectedSocket() client: Socket) {
    const me = this.requireIdentity(client);
    return { meetings: this.meetings.activeFor({ id: me.participantId, scope: me.scope }) };
  }

  @SubscribeMessage('meeting:sdp')
  onMeetingSdp(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { meetingId: string; toUserId: string; description: unknown },
  ) {
    const me = this.requireIdentity(client);
    for (const sid of this.meetings.socketsFor(body.meetingId, body.toUserId)) {
      this.server.to(sid).emit('meeting:sdp', {
        meetingId: body.meetingId,
        fromUserId: me.participantId,
        description: body.description,
      });
    }
  }

  @SubscribeMessage('meeting:ice')
  onMeetingIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { meetingId: string; toUserId: string; candidate: unknown },
  ) {
    const me = this.requireIdentity(client);
    for (const sid of this.meetings.socketsFor(body.meetingId, body.toUserId)) {
      this.server.to(sid).emit('meeting:ice', {
        meetingId: body.meetingId,
        fromUserId: me.participantId,
        candidate: body.candidate,
      });
    }
  }

  private async leaveMeeting(client: Socket, meetingId: string): Promise<void> {
    const info = this.meetings.info(meetingId);
    const res = this.meetings.leave(meetingId, client.id);
    void client.leave(`meeting:${meetingId}`);
    if (!res) return;
    if (res.gone) {
      this.server
        .to(`meeting:${meetingId}`)
        .emit('meeting:participant-left', { meetingId, userId: res.participant.id });
    }
    if (res.empty) await this.announceMeetingEnded(meetingId, res.meta, info?.startedAt);
  }

  /**
   * The meeting is over: tell the room and every invitee (clears pending
   * "join" banners/ringing), and close the group-chat announcement.
   */
  private async announceMeetingEnded(
    meetingId: string,
    meta: MeetingMeta,
    startedAt?: string,
  ): Promise<void> {
    const durationSec = startedAt
      ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
      : 0;
    const payload = { meetingId, durationSec };
    this.server.to(`meeting:${meetingId}`).emit('meeting:ended', payload);
    if (meta.invited === 'all') {
      this.server.emit('meeting:ended', payload);
    } else {
      for (const id of meta.invited) this.server.to(`user:${id}`).emit('meeting:ended', payload);
    }
    if (meta.chatMessageId) {
      await this.chat.closeMeetingAnnouncement(meta.chatMessageId, durationSec).catch(() => undefined);
    }
  }

  private async onRingTimeout(callId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call || call.status !== 'ringing') return;
    await this.calls.finish(callId, 'missed');
    this.server.to(`user:${call.callerId}`).emit('call:missed', { callId });
    this.server.to(`user:${call.calleeId}`).emit('call:missed', { callId });
    void this.pushCallCancelled(call.calleeId, callId);
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
      void this.pushCallCancelled(other, call.callId);
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

  /**
   * Dismiss a backgrounded callee's ring: when the invite was delivered ONLY by
   * FCM (no live socket), the later call:cancelled/ended/missed goes to an empty
   * room and the full-screen notification never clears. A data-only cancel push
   * lets the device dismiss it. Self-guards: skips admins (no device token) and
   * anyone with a live socket (they already got the socket event).
   */
  private async pushCallCancelled(userId: string, callId: string): Promise<void> {
    if (userId === ADMIN_ID) return;
    if (this.presence.isOnline(userId)) return;
    try {
      await this.push.sendToEmployee(userId, "Qo'ng'iroq tugadi", '', {
        type: 'call_cancelled',
        callId,
      });
    } catch {
      /* push disabled / no tokens */
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

/** Room ids come from clients — keep them short and harmless. */
function sanitizeMeetingId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const clean = id.trim();
  return /^[A-Za-z0-9:_-]{1,80}$/.test(clean) ? clean : null;
}
