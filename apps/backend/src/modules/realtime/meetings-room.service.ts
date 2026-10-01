import { Injectable } from '@nestjs/common';
import { UserScope } from './interfaces/socket-identity.interface';

/** One person in a meeting (several sockets of the same person share it). */
export interface MeetingParticipant {
  /** Routing id inside meetings: employee id, or `admin:<adminUserId>`. */
  id: string;
  name: string;
  avatar?: string;
  scope: UserScope;
  audio: boolean;
  video: boolean;
}

/** Public, serialisable view of a live meeting. */
export interface MeetingInfo {
  meetingId: string;
  title: string;
  media: 'audio' | 'video';
  hostId: string;
  hostName: string;
  startedAt: string;
  count: number;
}

export interface MeetingMeta {
  title: string;
  media: 'audio' | 'video';
  hostId: string;
  hostName: string;
  /** Employee ids invited, or 'all' (every employee). Admins may always join. */
  invited: Set<string> | 'all';
  /** Group-chat announcement row, if one was posted. */
  chatMessageId?: string;
}

interface Room extends MeetingMeta {
  startedAt: Date;
  /** socketId -> participant */
  sockets: Map<string, MeetingParticipant>;
}

/**
 * Ephemeral (in-memory) multi-party meeting rooms for the mesh-WebRTC
 * "yig'ilish / guruh qo'ng'irog'i". A room exists while it has participants
 * or a pending invite. Each person has a stable routing id (admins are
 * `admin:<id>` here, so two admins see each other — the chat/call `'me'`
 * alias would collapse them into one). SDP/ICE are relayed per socket.
 */
@Injectable()
export class MeetingRoomService {
  private readonly rooms = new Map<string, Room>();

  /** Create a room (or refresh its invite list) before anyone joins. */
  open(meetingId: string, meta: MeetingMeta): void {
    const room = this.rooms.get(meetingId);
    if (room) {
      room.invited = mergeInvites(room.invited, meta.invited);
      if (meta.chatMessageId) room.chatMessageId = meta.chatMessageId;
      return;
    }
    this.rooms.set(meetingId, { ...meta, startedAt: new Date(), sockets: new Map() });
  }

  setChatMessage(meetingId: string, chatMessageId: string): void {
    const room = this.rooms.get(meetingId);
    if (room) room.chatMessageId = chatMessageId;
  }

  /** Current invite list (null when the room doesn't exist). */
  invitedOf(meetingId: string): Set<string> | 'all' | null {
    return this.rooms.get(meetingId)?.invited ?? null;
  }

  /** May this person enter? Admins always; employees only when invited. */
  canJoin(meetingId: string, participant: Pick<MeetingParticipant, 'id' | 'scope'>): boolean {
    if (participant.scope === 'admin') return true;
    const room = this.rooms.get(meetingId);
    if (!room) return false;
    return room.invited === 'all' || room.invited.has(participant.id) || room.hostId === participant.id;
  }

  /**
   * Join a room (an admin joining an unknown id opens it as host). Returns
   * the people already present (excluding the joiner) — the newcomer
   * mesh-offers to each of them.
   */
  join(meetingId: string, socketId: string, participant: MeetingParticipant): MeetingParticipant[] {
    let room = this.rooms.get(meetingId);
    if (!room) {
      room = {
        title: "Yig'ilish",
        media: 'video',
        hostId: participant.id,
        hostName: participant.name,
        invited: new Set(),
        startedAt: new Date(),
        sockets: new Map(),
      };
      this.rooms.set(meetingId, room);
    }
    const existing = this.distinct(room, participant.id);
    // A second device of the same person inherits their current media state.
    const same = [...room.sockets.values()].find((p) => p.id === participant.id);
    room.sockets.set(socketId, same ? { ...participant, audio: same.audio, video: same.video } : participant);
    return existing;
  }

  /**
   * Leave a room. `gone` = no other socket of that person remains (only then
   * do peers drop them); `empty` = nobody is left — the meeting is over.
   */
  leave(
    meetingId: string,
    socketId: string,
  ): { participant: MeetingParticipant; gone: boolean; empty: boolean; meta: MeetingMeta } | null {
    const room = this.rooms.get(meetingId);
    if (!room) return null;
    const participant = room.sockets.get(socketId);
    if (!participant) return null;
    room.sockets.delete(socketId);
    const gone = ![...room.sockets.values()].some((p) => p.id === participant.id);
    const empty = room.sockets.size === 0;
    if (empty) this.rooms.delete(meetingId);
    return { participant, gone, empty, meta: room };
  }

  /** Update one person's mic/camera state (all their sockets). */
  setMedia(meetingId: string, participantId: string, audio: boolean, video: boolean): boolean {
    const room = this.rooms.get(meetingId);
    if (!room) return false;
    let found = false;
    for (const [sid, p] of room.sockets) {
      if (p.id === participantId) {
        room.sockets.set(sid, { ...p, audio, video });
        found = true;
      }
    }
    return found;
  }

  /** Close a room for everyone. Returns its meta, or null if unknown. */
  end(meetingId: string): MeetingMeta | null {
    const room = this.rooms.get(meetingId);
    if (!room) return null;
    this.rooms.delete(meetingId);
    return room;
  }

  isHost(meetingId: string, participantId: string): boolean {
    return this.rooms.get(meetingId)?.hostId === participantId;
  }

  info(meetingId: string): MeetingInfo | null {
    const room = this.rooms.get(meetingId);
    if (!room) return null;
    return {
      meetingId,
      title: room.title,
      media: room.media,
      hostId: room.hostId,
      hostName: room.hostName,
      startedAt: room.startedAt.toISOString(),
      count: this.distinct(room, '').length,
    };
  }

  /** Live meetings this person may join (admins: all). */
  activeFor(participant: Pick<MeetingParticipant, 'id' | 'scope'>): MeetingInfo[] {
    const out: MeetingInfo[] = [];
    for (const meetingId of this.rooms.keys()) {
      if (this.canJoin(meetingId, participant)) out.push(this.info(meetingId)!);
    }
    return out;
  }

  /** Everyone currently in the room (one entry per person). */
  participants(meetingId: string): MeetingParticipant[] {
    const room = this.rooms.get(meetingId);
    return room ? this.distinct(room, '') : [];
  }

  /** Meetings a socket is currently in (for disconnect teardown). */
  meetingsOf(socketId: string): string[] {
    const out: string[] = [];
    for (const [meetingId, room] of this.rooms) {
      if (room.sockets.has(socketId)) out.push(meetingId);
    }
    return out;
  }

  /** Socket ids in a meeting held by this participant id (targeted relay). */
  socketsFor(meetingId: string, participantId: string): string[] {
    const room = this.rooms.get(meetingId);
    if (!room) return [];
    const out: string[] = [];
    for (const [socketId, p] of room.sockets) {
      if (p.id === participantId) out.push(socketId);
    }
    return out;
  }

  private distinct(room: Room, excludeId: string): MeetingParticipant[] {
    const seen = new Set<string>();
    const out: MeetingParticipant[] = [];
    for (const p of room.sockets.values()) {
      if (p.id === excludeId || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }
}

function mergeInvites(a: Set<string> | 'all', b: Set<string> | 'all'): Set<string> | 'all' {
  if (a === 'all' || b === 'all') return 'all';
  return new Set([...a, ...b]);
}
