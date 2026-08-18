import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/shared/api/client';
import { useRealtime } from './RealtimeProvider';

/* ============================================================
   1:1 WebRTC qo'ng'iroq (audio/video) — global holat mashinasi.

   Frozen socket kontrakti (docs/.../2026-08-18-realtime-chat-calls-contract.md):
   client→server: call:invite {toUserId, media, conversationId?} (ack→{callId}),
     call:accept {callId}, call:reject, call:cancel, call:sdp {callId,description},
     call:ice {callId,candidate}, call:end {callId}
   server→client: call:incoming {callId, from:{id,name,avatar?}, media},
     call:accepted, call:rejected, call:cancelled, call:busy, call:missed,
     call:sdp {callId,description}, call:ice {callId,candidate},
     call:ended {callId,durationSec}

   Media butunlay peer-to-peer (ICE serverlar GET /rt/ice-servers'dan). Bir
   vaqtda faqat BITTA RTCPeerConnection boshqariladi. Butun ilova bo'ylab
   ishlashi uchun provider providers.tsx'da RealtimeProvider ichida mount qilinadi
   va <CallOverlay/> shu yerda bir marta ko'rsatiladi.
   ============================================================ */

export type CallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'active'
  | 'ended';

export type CallMedia = 'audio' | 'video';

/** 'ended' fazasida ko'rsatiladigan sabab (nega qo'ng'iroq tugadi). */
export type CallEndReason =
  | 'ended'
  | 'rejected'
  | 'busy'
  | 'missed'
  | 'cancelled'
  | 'failed'
  | 'error';

export interface CallPeer {
  id: string;
  name: string;
  avatar?: string;
  media: CallMedia;
}

interface CallContextValue {
  phase: CallPhase;
  callId: string | null;
  peer: CallPeer | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  camOff: boolean;
  durationSec: number;
  /** getUserMedia rad etilganda ko'rsatiladigan xabar (aks holda null). */
  error: string | null;
  endReason: CallEndReason | null;
  startCall: (toUserId: string, name: string, media: CallMedia) => void;
  accept: () => void;
  reject: () => void;
  cancel: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCam: () => void;
  /** 'ended'/xatolik oynasini qo'lda yopish (o'zi ham avto-yopiladi). */
  dismiss: () => void;
}

const noop = () => {};
const CallContext = createContext<CallContextValue>({
  phase: 'idle',
  callId: null,
  peer: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  camOff: false,
  durationSec: 0,
  error: null,
  endReason: null,
  startCall: noop,
  accept: noop,
  reject: noop,
  cancel: noop,
  hangup: noop,
  toggleMute: noop,
  toggleCam: noop,
  dismiss: noop,
});

/** Faol qo'ng'iroqning imperativ (React'dan tashqari) konteksti. */
interface Session {
  callId: string;
  role: 'caller' | 'callee';
  media: CallMedia;
  peerId: string;
  pc: RTCPeerConnection | null;
  remoteDescSet: boolean;
  /** remoteDescription o'rnatilguncha kelib qolgan ICE nomzodlari. */
  pending: RTCIceCandidateInit[];
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const BUSY_PHASES: CallPhase[] = ['outgoing', 'incoming', 'connecting', 'active'];

async function getMedia(media: CallMedia): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Media qurilma qo‘llab-quvvatlanmaydi', 'NotFoundError');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: media === 'video',
  });
}

function mediaErrorMessage(e: unknown): string {
  const name = (e as DOMException | undefined)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError')
    return "Kamera/mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.";
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError')
    return "Kamera yoki mikrofon topilmadi.";
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError')
    return "Qurilma band — kamerani boshqa dastur ishlatyapti.";
  return "Media qurilmasini yoqib bo‘lmadi.";
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useRealtime();

  const [phase, setPhaseState] = useState<CallPhase>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<CallEndReason | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const phaseRef = useRef<CallPhase>('idle');
  const timerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const setPhase = useCallback((p: CallPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Barcha oqimlarni to'xtatadi, PC'ni yopadi, sessiyani tozalaydi (idempotent). */
  const teardown = useCallback(() => {
    const s = sessionRef.current;
    if (s) {
      s.localStream?.getTracks().forEach((t) => t.stop());
      s.remoteStream?.getTracks().forEach((t) => t.stop());
      if (s.pc) {
        s.pc.onicecandidate = null;
        s.pc.ontrack = null;
        s.pc.onconnectionstatechange = null;
        try {
          s.pc.close();
        } catch {
          /* ignore */
        }
      }
    }
    sessionRef.current = null;
    stopTimer();
  }, [stopTimer]);

  /** To'liq boshlang'ich holatga qaytadi (overlay yopiladi). */
  const goIdle = useCallback(() => {
    clearResetTimer();
    teardown();
    setPhase('idle');
    setCallId(null);
    setPeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCamOff(false);
    setDurationSec(0);
    setError(null);
    setEndReason(null);
  }, [clearResetTimer, teardown, setPhase]);

  /** Qo'ng'iroqni "tugadi" ekraniga o'tkazadi (sabab + ixtiyoriy xabar), so'ng avto-yopadi. */
  const finish = useCallback(
    (reason: CallEndReason, message?: string) => {
      teardown();
      setLocalStream(null);
      setRemoteStream(null);
      setMuted(false);
      setCamOff(false);
      setError(message ?? null);
      setEndReason(reason);
      setPhase('ended');
      clearResetTimer();
      resetTimerRef.current = window.setTimeout(() => goIdle(), reason === 'error' ? 4200 : 2200);
    },
    [teardown, clearResetTimer, goIdle, setPhase],
  );

  const startTimer = useCallback(() => {
    stopTimer();
    const startedAt = Date.now();
    setDurationSec(0);
    timerRef.current = window.setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
  }, [stopTimer]);

  /**
   * ICE serverlarni oladi, RTCPeerConnection yaratadi, ontrack/onicecandidate/
   * onconnectionstatechange'ni ulaydi va mahalliy treklarni qo'shadi.
   */
  const createPeer = useCallback(
    async (session: Session): Promise<RTCPeerConnection> => {
      const { iceServers } = await api.get<{ iceServers: RTCIceServer[] }>('/rt/ice-servers');
      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit('call:ice', { callId: session.callId, candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        const ms =
          stream ??
          (() => {
            const m = new MediaStream();
            m.addTrack(e.track);
            return m;
          })();
        session.remoteStream = ms;
        setRemoteStream(ms);
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') {
          if (phaseRef.current !== 'active') {
            setPhase('active');
            startTimer();
          }
        } else if (st === 'failed') {
          finish('failed');
        }
      };

      session.localStream?.getTracks().forEach((t) => {
        if (session.localStream) pc.addTrack(t, session.localStream);
      });
      session.pc = pc;
      return pc;
    },
    [socket, setPhase, startTimer, finish],
  );

  const flushPending = useCallback(async (s: Session) => {
    const list = s.pending;
    s.pending = [];
    for (const c of list) {
      try {
        await s.pc?.addIceCandidate(c);
      } catch {
        /* ignore bad candidate */
      }
    }
  }, []);

  /* ---------------- Public API (barqaror) ---------------- */

  const startCall = useCallback(
    async (toUserId: string, name: string, media: CallMedia) => {
      if (!socket || BUSY_PHASES.includes(phaseRef.current)) return;
      clearResetTimer();
      setError(null);
      setEndReason(null);

      let stream: MediaStream;
      try {
        stream = await getMedia(media);
      } catch (e) {
        finish('error', mediaErrorMessage(e));
        return;
      }

      const session: Session = {
        callId: '',
        role: 'caller',
        media,
        peerId: toUserId,
        pc: null,
        remoteDescSet: false,
        pending: [],
        localStream: stream,
        remoteStream: null,
      };
      sessionRef.current = session;

      setLocalStream(stream);
      setMuted(false);
      setCamOff(false);
      setPeer({ id: toUserId, name, media });
      setDurationSec(0);
      setPhase('outgoing');

      socket.emit('call:invite', { toUserId, media }, (ack?: { callId?: string }) => {
        // Javob kelguncha bekor qilingan bo'lishi mumkin.
        if (sessionRef.current !== session) return;
        if (!ack?.callId) {
          finish('failed');
          return;
        }
        session.callId = ack.callId;
        setCallId(ack.callId);
      });
    },
    [socket, clearResetTimer, finish, setPhase],
  );

  const accept = useCallback(async () => {
    const s = sessionRef.current;
    if (!socket || !s || s.role !== 'callee' || phaseRef.current !== 'incoming') return;

    let stream: MediaStream;
    try {
      stream = await getMedia(s.media);
    } catch (e) {
      if (s.callId) socket.emit('call:reject', { callId: s.callId });
      finish('error', mediaErrorMessage(e));
      return;
    }
    s.localStream = stream;
    setLocalStream(stream);
    setMuted(false);
    setCamOff(false);
    setPhase('connecting');

    // PC'ni call:accept'dan OLDIN tayyorlaymiz — chaqiruvchi accepted'ni olib
    // offer yuborganda bizning PC allaqachon tayyor bo'ladi (poyga oldini olish).
    try {
      await createPeer(s);
    } catch {
      if (s.callId) socket.emit('call:reject', { callId: s.callId });
      finish('failed');
      return;
    }
    socket.emit('call:accept', { callId: s.callId });
  }, [socket, createPeer, finish, setPhase]);

  const reject = useCallback(() => {
    const s = sessionRef.current;
    if (socket && s?.callId) socket.emit('call:reject', { callId: s.callId });
    goIdle();
  }, [socket, goIdle]);

  const cancel = useCallback(() => {
    const s = sessionRef.current;
    if (socket && s?.callId) socket.emit('call:cancel', { callId: s.callId });
    goIdle();
  }, [socket, goIdle]);

  const hangup = useCallback(() => {
    const s = sessionRef.current;
    if (socket && s?.callId) socket.emit('call:end', { callId: s.callId });
    goIdle();
  }, [socket, goIdle]);

  const toggleMute = useCallback(() => {
    const stream = sessionRef.current?.localStream;
    if (!stream) return;
    setMuted((prev) => {
      const next = !prev;
      stream.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    const stream = sessionRef.current?.localStream;
    if (!stream) return;
    setCamOff((prev) => {
      const next = !prev;
      stream.getVideoTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const dismiss = useCallback(() => {
    goIdle();
  }, [goIdle]);

  /* ---------------- Server → client handlerlar (engine) ----------------
     engineRef har renderda yangilanadi — socket obunasi faqat [socket]'ga
     bog'liq bo'ladi va handlerlar hech qachon eskirmaydi (stale closure yo'q). */

  const handleIncoming = (p: {
    callId: string;
    from: { id: string; name: string; avatar?: string };
    media: CallMedia;
  }) => {
    if (BUSY_PHASES.includes(phaseRef.current)) {
      // Boshqa qo'ng'iroqdamiz — server ham busy yuboradi, biz rad etamiz.
      socket?.emit('call:reject', { callId: p.callId });
      return;
    }
    clearResetTimer();
    setError(null);
    setEndReason(null);
    const session: Session = {
      callId: p.callId,
      role: 'callee',
      media: p.media,
      peerId: p.from.id,
      pc: null,
      remoteDescSet: false,
      pending: [],
      localStream: null,
      remoteStream: null,
    };
    sessionRef.current = session;
    setCallId(p.callId);
    setPeer({ id: p.from.id, name: p.from.name, avatar: p.from.avatar, media: p.media });
    setDurationSec(0);
    setPhase('incoming');
  };

  const handleAccepted = async (p: { callId: string }) => {
    const s = sessionRef.current;
    if (!s || s.role !== 'caller' || s.callId !== p.callId || !socket) return;
    setPhase('connecting');
    try {
      const pc = await createPeer(s);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:sdp', { callId: s.callId, description: offer });
    } catch {
      hangup();
    }
  };

  const handleSdp = async (p: { callId: string; description: RTCSessionDescriptionInit }) => {
    const s = sessionRef.current;
    if (!s || s.callId !== p.callId || !s.pc || !socket) return;
    try {
      if (p.description.type === 'offer') {
        await s.pc.setRemoteDescription(p.description);
        s.remoteDescSet = true;
        await flushPending(s);
        const answer = await s.pc.createAnswer();
        await s.pc.setLocalDescription(answer);
        socket.emit('call:sdp', { callId: s.callId, description: answer });
      } else if (p.description.type === 'answer') {
        await s.pc.setRemoteDescription(p.description);
        s.remoteDescSet = true;
        await flushPending(s);
      }
    } catch {
      finish('failed');
    }
  };

  const handleIce = async (p: { callId: string; candidate: RTCIceCandidateInit }) => {
    const s = sessionRef.current;
    if (!s || s.callId !== p.callId) return;
    if (s.pc && s.remoteDescSet) {
      try {
        await s.pc.addIceCandidate(p.candidate);
      } catch {
        /* ignore */
      }
    } else {
      s.pending.push(p.candidate);
    }
  };

  const handleRejected = (p: { callId: string }) => {
    const s = sessionRef.current;
    if (!s || s.callId !== p.callId) return;
    finish('rejected');
  };
  const handleBusy = (p: { callId: string }) => {
    const s = sessionRef.current;
    if (!s || (s.callId && s.callId !== p.callId)) return;
    finish('busy');
  };
  const handleMissed = (p: { callId: string }) => {
    const s = sessionRef.current;
    if (!s || s.callId !== p.callId) return;
    finish('missed');
  };
  const handleCancelled = (p: { callId: string }) => {
    const s = sessionRef.current;
    if (!s || s.callId !== p.callId) return;
    // Chaqiruvchi javobdan oldin bekor qildi — ring shunchaki yo'qoladi.
    goIdle();
  };
  const handleEnded = (p: { callId: string; durationSec?: number }) => {
    const s = sessionRef.current;
    if (!s || s.callId !== p.callId) return;
    if (typeof p.durationSec === 'number') setDurationSec(p.durationSec);
    finish('ended');
  };

  const engineRef = useRef({
    handleIncoming,
    handleAccepted,
    handleSdp,
    handleIce,
    handleRejected,
    handleBusy,
    handleMissed,
    handleCancelled,
    handleEnded,
  });
  // Handlerlar har renderda yangi closure sifatida qayta hosil bo'ladi; ularni
  // effect ichida ref'ga yozamiz — socket obunasi faqat [socket]'ga bog'lanadi va
  // handlerlar hech qachon eskirmaydi (ref'ni render paytida yozib bo'lmaydi).
  useEffect(() => {
    engineRef.current = {
      handleIncoming,
      handleAccepted,
      handleSdp,
      handleIce,
      handleRejected,
      handleBusy,
      handleMissed,
      handleCancelled,
      handleEnded,
    };
  });

  useEffect(() => {
    if (!socket) return;
    const onIncoming = (p: Parameters<typeof engineRef.current.handleIncoming>[0]) =>
      engineRef.current.handleIncoming(p);
    const onAccepted = (p: { callId: string }) => void engineRef.current.handleAccepted(p);
    const onSdp = (p: { callId: string; description: RTCSessionDescriptionInit }) =>
      void engineRef.current.handleSdp(p);
    const onIce = (p: { callId: string; candidate: RTCIceCandidateInit }) =>
      void engineRef.current.handleIce(p);
    const onRejected = (p: { callId: string }) => engineRef.current.handleRejected(p);
    const onBusy = (p: { callId: string }) => engineRef.current.handleBusy(p);
    const onMissed = (p: { callId: string }) => engineRef.current.handleMissed(p);
    const onCancelled = (p: { callId: string }) => engineRef.current.handleCancelled(p);
    const onEnded = (p: { callId: string; durationSec?: number }) =>
      engineRef.current.handleEnded(p);

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:sdp', onSdp);
    socket.on('call:ice', onIce);
    socket.on('call:rejected', onRejected);
    socket.on('call:busy', onBusy);
    socket.on('call:missed', onMissed);
    socket.on('call:cancelled', onCancelled);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:sdp', onSdp);
      socket.off('call:ice', onIce);
      socket.off('call:rejected', onRejected);
      socket.off('call:busy', onBusy);
      socket.off('call:missed', onMissed);
      socket.off('call:cancelled', onCancelled);
      socket.off('call:ended', onEnded);
    };
  }, [socket]);

  // Provider unmount — kamera chirog'i qolib ketmasligi uchun hamma narsani to'xtatamiz.
  useEffect(() => () => teardown(), [teardown]);

  // Socket uzilib qolsa (logout) — faol qo'ng'iroqni tozalaymiz.
  useEffect(() => {
    if (!socket && phaseRef.current !== 'idle') {
      goIdle();
    }
  }, [socket, goIdle]);

  const value = useMemo<CallContextValue>(
    () => ({
      phase,
      callId,
      peer,
      localStream,
      remoteStream,
      muted,
      camOff,
      durationSec,
      error,
      endReason,
      startCall,
      accept,
      reject,
      cancel,
      hangup,
      toggleMute,
      toggleCam,
      dismiss,
    }),
    [
      phase,
      callId,
      peer,
      localStream,
      remoteStream,
      muted,
      camOff,
      durationSec,
      error,
      endReason,
      startCall,
      accept,
      reject,
      cancel,
      hangup,
      toggleMute,
      toggleCam,
      dismiss,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

/** Global qo'ng'iroq holati va boshqaruvi. */
export function useCall(): CallContextValue {
  return useContext(CallContext);
}
