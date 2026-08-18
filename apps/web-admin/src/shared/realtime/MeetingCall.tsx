import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Microphone2,
  MicrophoneSlash,
  Video,
  VideoSlash,
  CallSlash,
  People,
  RecordCircle,
  SecurityUser,
  Danger,
  Refresh2,
  CloseCircle,
} from 'iconsax-react';
import { Avatar } from '@/shared/ui/Avatar';
import { api } from '@/shared/api/client';
import { cn } from '@/shared/lib/cn';
import { useRealtime } from './RealtimeProvider';
import { isSocketReady } from './socket';

/* ============================================================
   Haqiqiy ko'p tomonlama (mesh) video konferensiya.

   Frozen meeting-room socket kontrakti (shared socket orqali):
   client→server:
     meeting:join  {meetingId}                       → ack {participants:[{id,name,avatar?}]}
     meeting:leave {meetingId}
     meeting:sdp   {meetingId, toUserId, description}
     meeting:ice   {meetingId, toUserId, candidate}
   server→client:
     meeting:participant-joined {meetingId, participant:{id,name,avatar?}}
     meeting:participant-left   {meetingId, userId}
     meeting:sdp {meetingId, fromUserId, description}
     meeting:ice {meetingId, fromUserId, candidate}

   MESH KONVENSIYASI: YANGI kelgan ishtirokchi mavjud har bir ishtirokchiga
   OFFER yuboradi. Ya'ni: MEN qo'shilganda — ack'dagi har bir ishtirokchiga
   offer qilaman. Kimdir keyin qo'shilsa (participant-joined) — U menga offer
   qiladi, men uning meeting:sdp(offer)'ini kutib, answer qaytaraman.

   1:1 CallProvider naqshlari (ICE nomzodini remoteDescription'gacha navbatga
   qo'yish, ontrack→stream, to'liq teardown) bu yerda KO'P peer uchun
   takrorlangan: Map<userId, PeerEntry>.
   ============================================================ */

interface Participant {
  id: string;
  name: string;
  avatar?: string;
}

/** Bitta uzoq peer bilan bog'lanish holati (imperativ, React'dan tashqari). */
interface PeerEntry {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  name: string;
  avatar?: string;
  /** Uzoq tomon mikrofoni/kamerasi o'chirilgani (track mute hodisalaridan). */
  muted: boolean;
  camOff: boolean;
  remoteDescSet: boolean;
  /** remoteDescription o'rnatilguncha kelib qolgan ICE nomzodlari. */
  pending: RTCIceCandidateInit[];
}

/** To'r (grid) uchun render qilinadigan peer snapshoti. */
interface RemoteTileData {
  id: string;
  name: string;
  avatar?: string;
  stream: MediaStream | null;
  muted: boolean;
  camOff: boolean;
}

type Phase = 'connecting' | 'live' | 'error';

const UNSUPPORTED_MSG = 'Bu brauzer kamerani qo‘llab-quvvatlamaydi. Chrome yoki Edge’dan foydalaning.';

function mediaErrorMessage(e: unknown): string {
  const name = (e as DOMException | undefined)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError')
    return 'Kamera/mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError')
    return 'Kamera yoki mikrofon topilmadi.';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError')
    return 'Qurilma band — kamerani boshqa dastur ishlatyapti.';
  return 'Media qurilmasini yoqib bo‘lmadi.';
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mm}` : mm;
}

/** Umumiy ishtirokchilar soniga qarab to'r ustunlari. */
function gridCols(n: number): string {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (n <= 4) return 'grid-cols-2';
  if (n <= 6) return 'grid-cols-2 lg:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
}

export function MeetingCall({
  open,
  meetingId,
  title = 'Video konferensiya',
  subtitle,
  onClose,
}: {
  open: boolean;
  meetingId?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const { socket } = useRealtime();

  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [tiles, setTiles] = useState<RemoteTileData[]>([]);
  const [elapsed, setElapsed] = useState(0);

  /* ----- imperativ (render'dan tashqari) holat ----- */
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const namesRef = useRef<Map<string, { name: string; avatar?: string }>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const joinedRef = useRef(false);
  const runIdRef = useRef(0);
  // Auth-race gate: agar xonaga qo'shilishga urinilganda socket hali tayyor
  // bo'lmasa (presence:snapshot kelmagan), shu runId'ni saqlab, tayyor bo'lgach
  // meeting:join'ni yuboramiz.
  const pendingJoinRef = useRef<number | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  /** peersRef → tiles snapshotini render uchun yangilaydi. */
  const publish = useCallback(() => {
    const arr: RemoteTileData[] = [];
    peersRef.current.forEach((e, id) => {
      arr.push({ id, name: e.name, avatar: e.avatar, stream: e.stream, muted: e.muted, camOff: e.camOff });
    });
    setTiles(arr);
  }, []);

  /**
   * Bitta userId uchun RTCPeerConnection yaratadi (mavjud bo'lsa qaytaradi):
   * ICE emit, ontrack→stream, uzoq track mute/unmute indikatorlari, mahalliy
   * treklarni qo'shish. Offer YARATMAYDI — bu alohida (offerTo) yoki
   * javob-berish yo'lida bo'ladi.
   */
  const createPeer = useCallback(
    (userId: string): PeerEntry => {
      const existing = peersRef.current.get(userId);
      if (existing) return existing;

      const info = namesRef.current.get(userId);
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const entry: PeerEntry = {
        pc,
        stream: null,
        name: info?.name ?? 'Ishtirokchi',
        avatar: info?.avatar,
        muted: false,
        camOff: false,
        remoteDescSet: false,
        pending: [],
      };
      peersRef.current.set(userId, entry);

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit('meeting:ice', {
            meetingId,
            toUserId: userId,
            candidate: e.candidate.toJSON(),
          });
        }
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        entry.stream =
          stream ??
          (() => {
            const m = new MediaStream();
            m.addTrack(e.track);
            return m;
          })();
        // Uzoq track o'chirib/yoqilganda mute/kamera indikatorini yangilaymiz.
        // (Frozen kontrakt mute holatini uzatmaydi — track mute hodisasi haqiqiy
        // signal: jo'natuvchi track.enabled=false qilsa, bu tomonda 'mute' otiladi.)
        if (e.track.kind === 'audio') {
          e.track.onmute = () => {
            entry.muted = true;
            publish();
          };
          e.track.onunmute = () => {
            entry.muted = false;
            publish();
          };
        } else {
          e.track.onmute = () => {
            entry.camOff = true;
            publish();
          };
          e.track.onunmute = () => {
            entry.camOff = false;
            publish();
          };
        }
        publish();
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          try {
            pc.restartIce?.();
          } catch {
            /* ignore */
          }
        }
      };

      const local = localStreamRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));
      publish();
      return entry;
    },
    [publish, socket, meetingId],
  );

  /** Berilgan userId'ga offer yuboradi (men yangi kelgan bo'lsam). */
  const offerTo = useCallback(
    async (userId: string) => {
      const entry = createPeer(userId);
      try {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        socket?.emit('meeting:sdp', {
          meetingId,
          toUserId: userId,
          description: offer,
        });
      } catch {
        /* ignore — peer left / renegotiation race */
      }
    },
    [createPeer, socket, meetingId],
  );

  /**
   * Xonaga qo'shiladi: meeting:join emit → ack'dagi mavjud har bir ishtirokchiga
   * offer qilaman (mesh konvensiyasi). FAQAT socket auth tayyor bo'lganda
   * chaqiriladi (aks holda server emit'ni tashlab yuboradi).
   */
  const joinRoom = useCallback(
    (runId: number) => {
      if (runIdRef.current !== runId || !socket || !meetingId) return;
      socket.emit('meeting:join', { meetingId }, (ack?: { participants?: Participant[] }) => {
        if (runIdRef.current !== runId) return;
        joinedRef.current = true;
        (ack?.participants ?? []).forEach((pt) => {
          if (!pt?.id) return;
          namesRef.current.set(pt.id, { name: pt.name, avatar: pt.avatar });
          void offerTo(pt.id);
        });
        publish();
      });
    },
    [socket, meetingId, offerTo, publish],
  );

  const flushPending = useCallback(async (entry: PeerEntry) => {
    const list = entry.pending;
    entry.pending = [];
    for (const c of list) {
      try {
        await entry.pc.addIceCandidate(c);
      } catch {
        /* ignore bad candidate */
      }
    }
  }, []);

  /** Bitta peer'ni yopadi va olib tashlaydi. */
  const removePeer = useCallback(
    (userId: string) => {
      const entry = peersRef.current.get(userId);
      if (entry) {
        entry.pc.onicecandidate = null;
        entry.pc.ontrack = null;
        entry.pc.onconnectionstatechange = null;
        try {
          entry.pc.close();
        } catch {
          /* ignore */
        }
        peersRef.current.delete(userId);
      }
      namesRef.current.delete(userId);
      publish();
    },
    [publish],
  );

  /** Barcha peerlarni yopadi, mahalliy oqimni to'xtatadi (idempotent, setState'siz). */
  const fullTeardown = useCallback(() => {
    peersRef.current.forEach((entry) => {
      entry.pc.onicecandidate = null;
      entry.pc.ontrack = null;
      entry.pc.onconnectionstatechange = null;
      try {
        entry.pc.close();
      } catch {
        /* ignore */
      }
    });
    peersRef.current.clear();
    namesRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    joinedRef.current = false;
    pendingJoinRef.current = null;
  }, []);

  /** Xonadan chiqadi (leave emit) + to'liq teardown. */
  const cleanup = useCallback(() => {
    if (socket && joinedRef.current && meetingId) {
      socket.emit('meeting:leave', { meetingId });
    }
    fullTeardown();
  }, [fullTeardown, socket, meetingId]);

  /* ---------------- Server → client handlerlar (engine) ----------------
     Handlerlar har renderda yangi closure sifatida hosil bo'ladi va engineRef'ga
     yoziladi — socket obunasi faqat [open, socket]'ga bog'lanadi va handlerlar
     hech qachon eskirmaydi (stale closure yo'q). meetingId ham tabiiy yopiladi. */

  const onParticipantJoined = (p: { meetingId: string; participant: Participant }) => {
    if (p?.meetingId !== meetingId) return;
    const part = p.participant;
    if (!part?.id) return;
    namesRef.current.set(part.id, { name: part.name, avatar: part.avatar });
    // U menga offer qiladi — biz shunchaki peer/tile ("ulanmoqda") tayyorlaymiz.
    createPeer(part.id);
  };

  const onParticipantLeft = (p: { meetingId: string; userId: string }) => {
    if (p?.meetingId !== meetingId) return;
    removePeer(p.userId);
  };

  const onSdp = async (p: {
    meetingId: string;
    fromUserId: string;
    description: RTCSessionDescriptionInit;
  }) => {
    if (p?.meetingId !== meetingId) return;
    const { fromUserId, description } = p;
    if (description.type === 'offer') {
      const entry = createPeer(fromUserId);
      try {
        await entry.pc.setRemoteDescription(description);
        entry.remoteDescSet = true;
        await flushPending(entry);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        socket?.emit('meeting:sdp', {
          meetingId,
          toUserId: fromUserId,
          description: answer,
        });
      } catch {
        /* ignore */
      }
    } else if (description.type === 'answer') {
      const entry = peersRef.current.get(fromUserId);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(description);
        entry.remoteDescSet = true;
        await flushPending(entry);
      } catch {
        /* ignore */
      }
    }
  };

  const onIce = async (p: {
    meetingId: string;
    fromUserId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    if (p?.meetingId !== meetingId) return;
    const { fromUserId, candidate } = p;
    const entry = peersRef.current.get(fromUserId) ?? createPeer(fromUserId);
    if (entry.remoteDescSet) {
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch {
        /* ignore */
      }
    } else {
      entry.pending.push(candidate);
    }
  };

  /** Socket auth tugadi (presence:snapshot) — kutib turgan join bo'lsa yuboramiz. */
  const onReady = () => {
    if (pendingJoinRef.current !== null) {
      const rid = pendingJoinRef.current;
      pendingJoinRef.current = null;
      joinRoom(rid);
    }
  };

  /** Socket auth rad etildi — xatoni ko'rsatamiz, qayta urinish "bo'roni" YO'Q. */
  const onAuthError = (p?: { message?: string }) => {
    pendingJoinRef.current = null;
    runIdRef.current++; // uchayotgan start()/join'ni bekor qiladi
    fullTeardown();
    setError(p?.message || 'Ulanish tasdiqlanmadi. Iltimos, qayta kiring.');
    setPhase('error');
  };

  const engineRef = useRef({
    onParticipantJoined,
    onParticipantLeft,
    onSdp,
    onIce,
    onReady,
    onAuthError,
  });
  useEffect(() => {
    engineRef.current = {
      onParticipantJoined,
      onParticipantLeft,
      onSdp,
      onIce,
      onReady,
      onAuthError,
    };
  });

  /* ---------------- Media olish + xonaga qo'shilish ---------------- */
  const start = useCallback(async () => {
    const runId = ++runIdRef.current;
    fullTeardown();
    setPhase('connecting');
    setError(null);
    setMuted(false);
    setCamOff(false);
    setTiles([]);
    setLocalStream(null);
    setElapsed(0);

    if (!socket || !meetingId) return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      if (runIdRef.current === runId) {
        setError(UNSUPPORTED_MSG);
        setPhase('error');
      }
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (e) {
      if (runIdRef.current === runId) {
        setError(mediaErrorMessage(e));
        setPhase('error');
      }
      return;
    }
    if (runIdRef.current !== runId) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    // ICE serverlarni bir marta olamiz (peer yaratishdan oldin).
    try {
      const r = await api.get<{ iceServers: RTCIceServer[] }>('/rt/ice-servers');
      if (runIdRef.current === runId) iceServersRef.current = r?.iceServers ?? [];
    } catch {
      if (runIdRef.current === runId) iceServersRef.current = [];
    }
    if (runIdRef.current !== runId) return;

    setPhase('live');
    pendingJoinRef.current = null;
    // Auth-race gate: socket allaqachon tayyor bo'lsa (odatiy holat — login'da
    // ulangan) — darhol qo'shilamiz; aks holda presence:snapshot'ni kutamiz
    // (onReady join'ni yuboradi). Server tayyorlikkacha kelgan emit'ni tashlaydi.
    if (isSocketReady(socket)) {
      joinRoom(runId);
    } else {
      pendingJoinRef.current = runId;
    }
  }, [fullTeardown, joinRoom, socket, meetingId]);

  // Ochilganda media olib xonaga qo'shilamiz; yopilganda/unmountda tozalaymiz.
  useEffect(() => {
    if (!open || !meetingId || !socket) return;
    void start();
    return () => {
      runIdRef.current++; // uchayotgan start()'ni bekor qiladi
      cleanup();
    };
  }, [open, meetingId, socket, start, cleanup]);

  // Socket obunasi (barqaror — engineRef orqali)
  useEffect(() => {
    if (!open || !socket) return;
    const j = (p: { meetingId: string; participant: Participant }) =>
      engineRef.current.onParticipantJoined(p);
    const l = (p: { meetingId: string; userId: string }) => engineRef.current.onParticipantLeft(p);
    const s = (p: { meetingId: string; fromUserId: string; description: RTCSessionDescriptionInit }) =>
      void engineRef.current.onSdp(p);
    const i = (p: { meetingId: string; fromUserId: string; candidate: RTCIceCandidateInit }) =>
      void engineRef.current.onIce(p);
    // Auth tugagani signali (kutib turgan join'ni ochadi) + auth rad etilishi.
    const ready = () => engineRef.current.onReady();
    const authErr = (p?: { message?: string }) => engineRef.current.onAuthError(p);

    socket.on('meeting:participant-joined', j);
    socket.on('meeting:participant-left', l);
    socket.on('meeting:sdp', s);
    socket.on('meeting:ice', i);
    socket.on('presence:snapshot', ready);
    socket.on('auth:error', authErr);
    return () => {
      socket.off('meeting:participant-joined', j);
      socket.off('meeting:participant-left', l);
      socket.off('meeting:sdp', s);
      socket.off('meeting:ice', i);
      socket.off('presence:snapshot', ready);
      socket.off('auth:error', authErr);
    };
  }, [open, socket]);

  // Unmountda kamera chirog'i qolib ketmasligi uchun qo'shimcha kafolat.
  useEffect(() => () => fullTeardown(), [fullTeardown]);

  // Taymer (faqat jonli holatda). elapsed start()'da 0'ga tiklanadi.
  useEffect(() => {
    if (phase !== 'live') return;
    const started = Date.now();
    const iv = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(iv);
  }, [phase]);

  // Mahalliy oqimni <video> elementiga ulaymiz
  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream && !camOff) el.srcObject = localStream;
  }, [localStream, camOff, phase]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setMuted((prev) => {
      const next = !prev;
      stream.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setCamOff((prev) => {
      const next = !prev;
      stream.getVideoTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const leave = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const total = tiles.length + 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-70 flex flex-col bg-slate-950 text-white"
        >
          {phase === 'error' ? (
            /* ===================== XATOLIK (ruxsat berilmadi) ===================== */
            <div className="relative flex flex-1 items-center justify-center p-6">
              <button
                onClick={leave}
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                title="Yopish"
              >
                <CloseCircle size={20} variant="Bulk" />
              </button>
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
                  <Danger size={30} variant="Bulk" />
                </span>
                <h3 className="text-base font-semibold text-white">Ulanib bo‘lmadi</h3>
                <p className="text-sm text-white/60">{error}</p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => void start()}
                    className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/20"
                  >
                    <Refresh2 size={15} /> Qayta urinish
                  </button>
                  <button
                    onClick={leave}
                    className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Top bar */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400">
                    <RecordCircle size={13} variant="Bold" className="animate-pulse" /> LIVE
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{title}</h3>
                    <p className="flex items-center gap-1.5 truncate text-[11px] text-white/50">
                      {subtitle ? `${subtitle} · ` : ''}
                      <SecurityUser size={12} variant="Bulk" className="text-primary-400" />
                      {fmt(elapsed)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium sm:flex">
                    <People size={15} variant="Bulk" /> {total}
                  </span>
                  <button
                    onClick={leave}
                    title="Yopish"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <CloseCircle size={18} variant="Bulk" />
                  </button>
                </div>
              </div>

              {/* Stage */}
              <div className="relative flex-1 overflow-y-auto p-3 sm:p-5">
                <div className={cn('mx-auto grid h-full max-w-6xl auto-rows-fr gap-3', gridCols(total))}>
                  {/* Self */}
                  <div className="relative h-full min-h-35 overflow-hidden rounded-2xl bg-slate-800 ring-2 ring-white/15">
                    {localStream && !camOff ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full -scale-x-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-linear-to-br from-slate-800 to-slate-900">
                        {localStream ? (
                          <>
                            <Avatar name="Siz" color="#10b981" size={72} />
                            <span className="text-[11px] text-white/45">Kamera o‘chiq</span>
                          </>
                        ) : (
                          <>
                            <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-primary-400" />
                            <span className="text-xs text-white/55">Kamera yoqilmoqda…</span>
                          </>
                        )}
                      </div>
                    )}
                    <TileLabel name="Siz" muted={muted} self />
                  </div>

                  {/* Uzoq peerlar */}
                  <AnimatePresence>
                    {tiles.map((t) => (
                      <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                        className="h-full"
                      >
                        <RemoteTile tile={t} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Bo'sh xona — faqat men bor */}
                {phase === 'live' && tiles.length === 0 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
                    <span className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm">
                      Boshqa ishtirokchilar kutilmoqda…
                    </span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-2.5 border-t border-white/10 px-4 py-4 sm:gap-4">
                <ControlButton
                  active={!muted}
                  onClick={toggleMute}
                  label={muted ? 'Yoqish' : 'Mikrofon'}
                  icon={muted ? MicrophoneSlash : Microphone2}
                />
                <ControlButton
                  active={!camOff}
                  onClick={toggleCam}
                  label={camOff ? 'Yoqish' : 'Kamera'}
                  icon={camOff ? VideoSlash : Video}
                />
                <button
                  onClick={leave}
                  className="flex h-14 items-center gap-2 rounded-full bg-red-500 px-7 font-semibold text-white shadow-lg transition-colors hover:bg-red-600"
                >
                  <CallSlash size={22} variant="Bold" />
                  <span className="hidden sm:inline">Chiqish</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   Sub-komponentlar
   ============================================================ */

function RemoteTile({ tile }: { tile: RemoteTileData }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && tile.stream) ref.current.srcObject = tile.stream;
  }, [tile.stream]);

  const connecting = !tile.stream;
  const covered = connecting || tile.camOff; // avatar/spinner video ustidan

  return (
    <div className="relative h-full min-h-35 overflow-hidden rounded-2xl bg-slate-800 ring-2 ring-white/10">
      {/* Video har doim mavjud — audio uzoq tomondan eshitilishi uchun (muted EMAS). */}
      <video
        ref={ref}
        autoPlay
        playsInline
        className={cn('h-full w-full object-cover', covered && 'invisible')}
      />
      {covered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-br from-slate-800 to-slate-900">
          <Avatar name={tile.name} src={tile.avatar} size={64} />
          {connecting ? (
            <span className="flex items-center gap-2 text-xs text-white/55">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-primary-400" />
              ulanmoqda…
            </span>
          ) : (
            <span className="text-[11px] text-white/45">Kamera o‘chiq</span>
          )}
        </div>
      )}
      <TileLabel name={tile.name} muted={tile.muted} />
    </div>
  );
}

function TileLabel({ name, muted, self = false }: { name: string; muted: boolean; self?: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
      <span className="truncate text-xs font-medium text-white">
        {name}
        {self && <span className="ml-1 text-white/50">(siz)</span>}
      </span>
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          muted ? 'bg-red-500/80 text-white' : 'bg-white/15 text-white',
        )}
      >
        {muted ? <MicrophoneSlash size={13} variant="Bold" /> : <Microphone2 size={13} variant="Bold" />}
      </span>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Microphone2;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5" title={label}>
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
          active ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500/90 text-white hover:bg-red-500',
        )}
      >
        <Icon size={21} variant="Bulk" />
      </span>
      <span className="text-[10.5px] font-medium text-white/60">{label}</span>
    </button>
  );
}
