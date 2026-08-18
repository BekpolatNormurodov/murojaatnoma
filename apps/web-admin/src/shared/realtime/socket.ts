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
 * Sockets that have completed server-side auth. The gateway resolves socket
 * identity ASYNCHRONOUSLY (DB lookup) and DROPS any emit that arrives before
 * auth finishes; it signals readiness by emitting `presence:snapshot` exactly
 * once at the end of successful auth. We record readiness per-socket here so
 * callers (e.g. the meeting room) can gate their emits on it — even when auth
 * completed long before they mount (the usual case: socket authed at login).
 */
const readySockets = new WeakSet<Socket>();

/** True once the given socket has received `presence:snapshot` (auth complete). */
export function isSocketReady(s: Socket | null): boolean {
  return !!s && readySockets.has(s);
}

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
  const s = io(socketOrigin(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
  // Track async-auth readiness on the instance itself. `presence:snapshot` fires
  // at the end of each successful (re)auth; a disconnect makes it stale until the
  // next reconnect re-auths (the server re-emits presence:snapshot then).
  s.on('presence:snapshot', () => readySockets.add(s));
  s.on('disconnect', () => readySockets.delete(s));
  socket = s;
  return s;
}

/** Tears down the shared connection (on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
