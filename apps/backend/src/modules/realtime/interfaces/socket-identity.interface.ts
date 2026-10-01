/** Who a connected socket belongs to, resolved from the handshake JWT. */
export type UserScope = 'admin' | 'employee';

export interface SocketIdentity {
  /** Canonical routing id: 'me' for any admin, the employee id otherwise. */
  id: string;
  /**
   * Per-PERSON id for multi-party meetings: `admin:<adminUserId>` for admins
   * (so two admins are two participants), the employee id otherwise.
   */
  participantId: string;
  name: string;
  avatar?: string;
  scope: UserScope;
}

export type CallMedia = 'audio' | 'video';

export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'rejected'
  | 'missed'
  | 'cancelled'
  | 'ended'
  | 'busy';
