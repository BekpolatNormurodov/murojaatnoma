import { Injectable, Logger } from '@nestjs/common';
import { CallLog } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { CallMedia, CallStatus } from './interfaces/socket-identity.interface';

/** Live (in-memory) state of a call in progress — the ICE/SDP relay reads this
 * on every candidate, so it must not hit the DB per event. Persisted lifecycle
 * lives in the `CallLog` table for history. */
export interface ActiveCall {
  callId: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  media: CallMedia;
  status: CallStatus;
  answeredAt?: Date;
  ringTimeout?: ReturnType<typeof setTimeout>;
}

interface CreateCallInput {
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  media: CallMedia;
}

@Injectable()
export class CallsService {
  private readonly active = new Map<string, ActiveCall>();
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  /**
   * Mirror a terminal call into the admin↔employee chat thread (kind: call) so
   * it shows in both chat histories. Every terminal path (reject, cancel, end,
   * ring-timeout, disconnect teardown, busy) funnels through `finish`/`record`,
   * so this is the single hook. Never lets a chat failure break signaling.
   */
  private mirrorToChat(
    call: { callerId: string; calleeId: string; media: CallMedia },
    callId: string,
    status: CallStatus,
    durationSec: number,
  ): void {
    this.chat
      .recordCall({ callId, callerId: call.callerId, calleeId: call.calleeId, media: call.media, status, durationSec })
      .catch((err: unknown) =>
        this.logger.warn(`call ${callId} → chat row failed: ${err instanceof Error ? err.message : err}`),
      );
  }

  /** Is `userId` the caller or callee of this live call? */
  isParticipant(callId: string, userId: string): boolean {
    const call = this.active.get(callId);
    return !!call && (call.callerId === userId || call.calleeId === userId);
  }

  /** Is the user already ringing/on another call? */
  isBusy(userId: string): boolean {
    for (const call of this.active.values()) {
      if (
        (call.callerId === userId || call.calleeId === userId) &&
        (call.status === 'ringing' || call.status === 'accepted')
      ) {
        return true;
      }
    }
    return false;
  }

  /** Start a call: persist a ringing CallLog + track it in memory. */
  async createCall(input: CreateCallInput): Promise<ActiveCall> {
    const row = await this.prisma.callLog.create({
      data: {
        callerId: input.callerId,
        callerName: input.callerName,
        calleeId: input.calleeId,
        calleeName: input.calleeName,
        media: input.media,
        status: 'ringing',
      },
    });
    const call: ActiveCall = {
      callId: row.id,
      callerId: input.callerId,
      callerName: input.callerName,
      calleeId: input.calleeId,
      calleeName: input.calleeName,
      media: input.media,
      status: 'ringing',
    };
    this.active.set(row.id, call);
    return call;
  }

  /** Record a one-off terminal call (e.g. busy) without tracking it live. */
  async record(input: CreateCallInput, status: CallStatus): Promise<CallLog> {
    const row = await this.prisma.callLog.create({
      data: {
        callerId: input.callerId,
        callerName: input.callerName,
        calleeId: input.calleeId,
        calleeName: input.calleeName,
        media: input.media,
        status,
        endedAt: new Date(),
      },
    });
    this.mirrorToChat(input, row.id, status, 0);
    return row;
  }

  get(callId: string): ActiveCall | undefined {
    return this.active.get(callId);
  }

  clearRing(call: ActiveCall): void {
    if (call.ringTimeout) {
      clearTimeout(call.ringTimeout);
      call.ringTimeout = undefined;
    }
  }

  async accept(callId: string): Promise<void> {
    const call = this.active.get(callId);
    if (!call) return;
    call.status = 'accepted';
    call.answeredAt = new Date();
    await this.prisma.callLog
      .update({ where: { id: callId }, data: { status: 'accepted', answeredAt: call.answeredAt } })
      .catch(() => undefined);
  }

  /** Terminate a call, persist status + duration, drop it from the live map. */
  async finish(callId: string, status: CallStatus): Promise<number> {
    const call = this.active.get(callId);
    const endedAt = new Date();
    let durationSec = 0;
    if (call?.answeredAt) {
      durationSec = Math.max(
        0,
        Math.round((endedAt.getTime() - call.answeredAt.getTime()) / 1000),
      );
    }
    await this.prisma.callLog
      .update({ where: { id: callId }, data: { status, endedAt, durationSec } })
      .catch(() => undefined);
    // Only the first terminal transition is mirrored (a second finish for the
    // same call — e.g. end racing a disconnect teardown — finds no live call).
    if (call) this.mirrorToChat(call, callId, status, durationSec);
    this.active.delete(callId);
    return durationSec;
  }

  /** The peer on the other side of the call from `senderId`. */
  otherParty(callId: string, senderId: string): string | null {
    const call = this.active.get(callId);
    if (!call) return null;
    return call.callerId === senderId ? call.calleeId : call.callerId;
  }

  /** All live calls a user is part of (used to tear down on disconnect). */
  activeFor(userId: string): ActiveCall[] {
    return [...this.active.values()].filter(
      (c) => c.callerId === userId || c.calleeId === userId,
    );
  }

  /** Call history for the call-log UI (missed/incoming/outgoing). */
  history(userId: string, limit = 50): Promise<CallLog[]> {
    return this.prisma.callLog.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
