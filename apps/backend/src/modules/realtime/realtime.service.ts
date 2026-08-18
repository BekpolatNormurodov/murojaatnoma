import { Injectable } from '@nestjs/common';

/**
 * In-memory presence registry. Tracks which user ids currently have at least
 * one live socket (a user may be connected from several tabs/devices), plus a
 * last-seen timestamp for anyone offline. Presence is process-local — the
 * backend runs as a single instance, so this is sufficient; a multi-instance
 * deploy would move this to Redis.
 */
@Injectable()
export class RealtimeService {
  private readonly online = new Map<string, Set<string>>();
  private readonly lastSeen = new Map<string, Date>();

  /** Register a socket. Returns true if this made the user newly online. */
  addSocket(userId: string, socketId: string): boolean {
    let set = this.online.get(userId);
    const wasOffline = !set || set.size === 0;
    if (!set) {
      set = new Set<string>();
      this.online.set(userId, set);
    }
    set.add(socketId);
    return wasOffline;
  }

  /** Deregister a socket. Returns true if the user is now fully offline. */
  removeSocket(userId: string, socketId: string): boolean {
    const set = this.online.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.online.delete(userId);
      this.lastSeen.set(userId, new Date());
      return true;
    }
    return false;
  }

  isOnline(userId: string): boolean {
    return (this.online.get(userId)?.size ?? 0) > 0;
  }

  getLastSeen(userId: string): Date | undefined {
    return this.lastSeen.get(userId);
  }

  onlineUserIds(): string[] {
    return [...this.online.keys()];
  }
}
