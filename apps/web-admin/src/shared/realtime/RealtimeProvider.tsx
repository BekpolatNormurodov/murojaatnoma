import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/shared/store/auth';
import { getSocket, disconnectSocket } from './socket';

interface RealtimeContextValue {
  /** Shared Socket.IO connection, or null when logged out / not yet connected. */
  socket: Socket | null;
  /** True once the handshake succeeds; drives the "live" indicator. */
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({ socket: null, connected: false });

/**
 * Holds a single authenticated Socket.IO connection for the whole app and
 * exposes it via context. Connects when the admin is authenticated, tears down
 * on logout, and re-connects with a fresh token after a silent refresh (the
 * socket instance is keyed by token in {@link getSocket}).
 *
 * Live chat delivery, typing, presence, and WebRTC call signaling all ride this
 * one connection (see useRealtimeChat + the call manager).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const isAuthed = useAuth((s) => s.isAuthed);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthed || !token) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = getSocket(token);
    setSocket(s);
    setConnected(s.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    // The gateway signals a rejected/expired token via a custom 'auth:error'
    // event (NOT the reserved 'connect_error'). Stop reconnecting so a stale
    // token can't storm the gateway with reconnect attempts — a fresh token
    // (silent refresh → this effect re-runs) creates a new socket.
    const onAuthError = () => {
      setConnected(false);
      s.disconnect();
    };
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('auth:error', onAuthError);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('auth:error', onAuthError);
    };
  }, [token, isAuthed]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Access the shared realtime socket + connection status. */
export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
