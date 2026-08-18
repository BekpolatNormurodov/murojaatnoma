import { io, type Socket } from 'socket.io-client';
import { API_BASE } from '@/shared/api/config';

/**
 * Realtime gateway (live chat + WebRTC call signaling) — the Socket.IO server is
 * mounted at /socket.io on the SAME public host as the REST API (nginx proxies
 * /socket.io → backend:3000). We derive the origin from {@link API_BASE} by
 * dropping the trailing "/api", so both dev (VITE_API_URL=https://…/api) and
 * prod (same-origin "/api") resolve to the right host.
 */
export function socketOrigin(): string {
  if (API_BASE.startsWith('http')) {
    return API_BASE.replace(/\/api\/?$/, '');
  }
  // Same-origin relative base ("/api") → the page's own origin.
  return window.location.origin;
}

let socket: Socket | null = null;
let socketToken: string | null = null;

/**
 * The shared Socket.IO connection for the given JWT. Re-created when the token
 * changes (login / silent refresh / logout). Authenticated purely via the
 * handshake `auth.token`, exactly as the frozen realtime contract requires —
 * an invalid/absent token is refused with `connect_error`.
 */
export function getSocket(token: string): Socket {
  if (socket && socketToken === token) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socketToken = token;
  socket = io(socketOrigin(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

/** Tears down the shared connection (on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
