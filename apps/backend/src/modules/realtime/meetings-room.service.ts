import { Injectable } from '@nestjs/common';
import { SocketIdentity } from './interfaces/socket-identity.interface';

/**
 * Ephemeral (in-memory) multi-party meeting rooms for the mesh-WebRTC
 * "yig'ilish / selektor". No persistence — a room exists only while people are
 * in it. Keyed by `meetingId`; a participant is a connected socket.
 *
 * Participant identity = the socket's {@link SocketIdentity} (id='me' for any
 * admin, employeeId for employees). SDP/ICE are relayed to the specific
 * socket(s) holding the target participant id, so multiple sockets of the same
 * id degrade gracefully (for the demo: one admin 'me' + distinct employees).
 */
@Injectable()
export class MeetingRoomService {
  /** meetingId -> (socketId -> identity) */
  private readonly rooms = new Map<string, Map<string, SocketIdentity>>();

  /** Join a room; returns the DISTINCT participants already present (excluding
   * the joiner's own id) so the newcomer can mesh-offer to each of them. */
  join(meetingId: string, socketId: string, identity: SocketIdentity): SocketIdentity[] {
    let room = this.rooms.get(meetingId);
    if (!room) {
      room = new Map<string, SocketIdentity>();
      this.rooms.set(meetingId, room);
    }
    const existing = this.distinct(room, identity.id);
    room.set(socketId, identity);
    return existing;
  }

  /** Leave a room. Returns the identity that left and whether it is now fully
   * gone (no other socket of the same id remains) — only then do peers drop it. */
  leave(meetingId: string, socketId: string): { identity: SocketIdentity; gone: boolean } | null {
    const room = this.rooms.get(meetingId);
    if (!room) return null;
    const identity = room.get(socketId);
    if (!identity) return null;
    room.delete(socketId);
    const gone = ![...room.values()].some((i) => i.id === identity.id);
    if (room.size === 0) this.rooms.delete(meetingId);
    return { identity, gone };
  }

  /** Meetings a socket is currently in (for disconnect teardown). */
  meetingsOf(socketId: string): string[] {
    const out: string[] = [];
    for (const [meetingId, room] of this.rooms) {
      if (room.has(socketId)) out.push(meetingId);
    }
    return out;
  }

  /** Socket ids in a meeting whose participant id === userId (targeted relay). */
  socketsFor(meetingId: string, userId: string): string[] {
    const room = this.rooms.get(meetingId);
    if (!room) return [];
    const out: string[] = [];
    for (const [socketId, identity] of room) {
      if (identity.id === userId) out.push(socketId);
    }
    return out;
  }

  private distinct(room: Map<string, SocketIdentity>, excludeId: string): SocketIdentity[] {
    const seen = new Set<string>();
    const out: SocketIdentity[] = [];
    for (const identity of room.values()) {
      if (identity.id === excludeId || seen.has(identity.id)) continue;
      seen.add(identity.id);
      out.push(identity);
    }
    return out;
  }
}
