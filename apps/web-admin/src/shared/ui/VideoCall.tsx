import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Microphone2,
  MicrophoneSlash,
  Video,
  VideoSlash,
  CallSlash,
  People,
  Maximize4,
  RecordCircle,
  Refresh2,
  Monitor,
  Danger,
  ArrowDown2,
  CloseCircle,
  SecurityUser,
  EmojiHappy,
  Profile2User,
  Clock,
  Lock1,
} from 'iconsax-react';
import { Avatar } from './Avatar';
import { cn } from '@/shared/lib/cn';

/* ============================================================
   Video konferensiya (Zoom uslubidagi).
   - Avval "lobби" (oldindan kirish) ekrani: kamera ko'rinishi,
     qurilma tanlash, mikrofon darajasi, ruxsatni tekshirish.
   - So'ng konferensiya: ishtirokchilar to'ri, ekranni ulashish,
     reaksiyalar, ishtirokchilar paneli.
   - Haqiqiy kamera/mikrofon getUserMedia orqali yoqiladi; ruxsat
     berilmasa — aniq ko'rsatma + "Kamerasiz qo'shilish".
   ============================================================ */

export interface CallParticipant {
  id: string;
  name: string;
  photo?: string;
  color?: string;
  role?: string;
}

interface LiveParticipant extends CallParticipant {
  camOn: boolean;
  muted: boolean;
  speaking: boolean;
}

type Stage = 'lobby' | 'call';
type MediaStatus = 'idle' | 'requesting' | 'live' | 'error';
type MediaErrorKind = 'denied' | 'notfound' | 'inuse' | 'insecure' | 'unsupported' | 'unknown';

const REACTIONS = ['\uD83D\uDC4D', '\uD83D\uDC4F', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83D\uDE4C'];

const ERROR_META: Record<
  MediaErrorKind,
  { title: string; desc: string; tips?: string[]; retry: boolean }
> = {
  denied: {
    title: "Kamera/mikrofon ruxsati berilmadi",
    desc: "Davom etish uchun brauzerda kamera va mikrofonga ruxsat bering.",
    tips: [
      "Manzil satridagi qulf (\uD83D\uDD12) belgisini bosing",
      "\u201CKamera\u201D va \u201CMikrofon\u201D uchun \u201CRuxsat berish\u201Dni tanlang",
      "So\u2018ng \u201CQayta urinish\u201D tugmasini bosing",
    ],
    retry: true,
  },
  notfound: {
    title: "Kamera yoki mikrofon topilmadi",
    desc: "Qurilmaga ulangan kamera/mikrofon aniqlanmadi. Ulanishni tekshiring.",
    retry: true,
  },
  inuse: {
    title: "Qurilma band",
    desc: "Kamerangizni boshqa dastur ishlatyapti. O\u2018sha dasturni yopib, qayta urining.",
    retry: true,
  },
  insecure: {
    title: "Xavfsiz ulanish (HTTPS) kerak",
    desc: "Kamera/mikrofon faqat HTTPS yoki localhost orqali ishlaydi.",
    retry: false,
  },
  unsupported: {
    title: "Brauzer qo\u2018llab-quvvatlamaydi",
    desc: "Bu brauzer kamerani qo\u2018llab-quvvatlamaydi. Chrome yoki Edge\u2019dan foydalaning.",
    retry: false,
  },
  unknown: {
    title: "Xatolik yuz berdi",
    desc: "Kamera/mikrofonni yoqib bo\u2018lmadi. Qayta urinib ko\u2018ring.",
    retry: true,
  },
};

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mm}` : mm;
}

function gridCols(n: number): string {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (n <= 4) return 'grid-cols-2';
  if (n <= 6) return 'grid-cols-2 lg:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
}

function classifyError(e: unknown): MediaErrorKind {
  const name = (e as DOMException | undefined)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError')
    return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError')
    return 'notfound';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError')
    return 'inuse';
  return 'unknown';
}

function formatSchedule(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return null;
  const time = d.toTimeString().slice(0, 5);
  const date = d.toLocaleDateString('en-GB').replace(/\//g, '.');
  return `${date} \u00B7 ${time}`;
}

/** Mikrofon darajasi (0..1) — lobби'da "mikrofon ishlayaptimi" tekshiruvi uchun. */
function useMicLevel(stream: MediaStream | null, active: boolean): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || !active) {
      setLevel(0);
      return;
    }
    if (stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }
    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(1, sum / data.length / 70));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* AudioContext mavjud emas — darajani ko'rsatmaymiz */
    }
    return () => {
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [stream, active]);
  return level;
}

export function VideoCall({
  open,
  onClose,
  title = 'Video konferensiya',
  subtitle,
  participants = [],
  scheduledAt,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  participants?: CallParticipant[];
  scheduledAt?: string;
}) {
  const [stage, setStage] = useState<Stage>('lobby');
  const [status, setStatus] = useState<MediaStatus>('idle');
  const [errorKind, setErrorKind] = useState<MediaErrorKind>('unknown');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState<string>('');
  const [audioId, setAudioId] = useState<string>('');

  const [elapsed, setElapsed] = useState(0);
  const [joined, setJoined] = useState<LiveParticipant[]>([]);
  const [toast, setToast] = useState<{ id: number; name: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const reactionSeq = useRef(0);

  const micLevel = useMicLevel(stream, micOn && status === 'live');
  const hasVideoDevice = useMemo(() => stream?.getVideoTracks().length ?? 0, [stream]);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const schedule = formatSchedule(scheduledAt);

  const setActiveStream = useCallback((s: MediaStream | null) => {
    streamRef.current = s;
    setStream(s);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setActiveStream(null);
  }, [setActiveStream]);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setVideoInputs(list.filter((d) => d.kind === 'videoinput'));
      setAudioInputs(list.filter((d) => d.kind === 'audioinput'));
    } catch {
      /* ignore */
    }
  }, []);

  const requestMedia = useCallback(
    async (overrides?: { video?: string; audio?: string }) => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setErrorKind('insecure');
        setStatus('error');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorKind('unsupported');
        setStatus('error');
        return;
      }
      setStatus('requesting');
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const v = overrides?.video ?? videoId;
      const a = overrides?.audio ?? audioId;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: v ? { deviceId: { exact: v } } : true,
          audio: a ? { deviceId: { exact: a } } : true,
        });
        s.getAudioTracks().forEach((t) => (t.enabled = micOn));
        s.getVideoTracks().forEach((t) => (t.enabled = camOn));
        setActiveStream(s);
        const vt = s.getVideoTracks()[0];
        const at = s.getAudioTracks()[0];
        if (vt) setVideoId(vt.getSettings().deviceId ?? '');
        if (at) setAudioId(at.getSettings().deviceId ?? '');
        await refreshDevices();
        setStatus('live');
      } catch (e) {
        setErrorKind(classifyError(e));
        setStatus('error');
      }
    },
    [videoId, audioId, micOn, camOn, setActiveStream, refreshDevices],
  );

  // Ochilganda holatni tiklab, lobби'da media so'raymiz
  useEffect(() => {
    if (!open) return;
    setStage('lobby');
    setElapsed(0);
    setJoined([]);
    setSharing(false);
    setMicOn(true);
    setCamOn(true);
    setPanelOpen(false);
    setPickerOpen(false);
    setReactions([]);
    void requestMedia();
    return () => {
      stopStream();
      setStatus('idle');
    };
    // faqat ochilishda ishga tushadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Streamni faol <video> elementiga ulaymiz (lobби yoki konferensiya)
  useEffect(() => {
    const el = selfVideoRef.current;
    if (el && stream && status === 'live' && camOn) {
      el.srcObject = stream;
    }
  }, [stream, status, camOn, stage, sharing, panelOpen]);

  // Qo'ng'iroq taymeri (faqat konferensiyada)
  useEffect(() => {
    if (stage !== 'call') return;
    const iv = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(iv);
  }, [stage]);

  // Ishtirokchilar bittalab qo'shiladi (konferensiya boshlanganda)
  useEffect(() => {
    if (stage !== 'call' || participants.length === 0) return;
    const timers: number[] = [];
    let toastId = 0;
    participants.slice(0, 8).forEach((p, i) => {
      const t = window.setTimeout(
        () => {
          setJoined((prev) =>
            prev.some((x) => x.id === p.id)
              ? prev
              : [
                  ...prev,
                  { ...p, camOn: Math.random() > 0.28, muted: Math.random() > 0.55, speaking: false },
                ],
          );
          const tid = ++toastId;
          setToast({ id: tid, name: p.name });
          window.setTimeout(() => setToast((cur) => (cur?.id === tid ? null : cur)), 2600);
        },
        900 + i * 1500 + Math.random() * 600,
      );
      timers.push(t);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [stage, participants]);

  // "Gapirish" simulyatsiyasi (yashil halqa)
  useEffect(() => {
    if (stage !== 'call' || joined.length === 0) return;
    const iv = window.setInterval(() => {
      setJoined((prev) => {
        if (prev.length === 0) return prev;
        const idx = Math.random() > 0.35 ? Math.floor(Math.random() * prev.length) : -1;
        return prev.map((p, i) => ({ ...p, speaking: i === idx && !p.muted }));
      });
    }, 1900);
    return () => window.clearInterval(iv);
  }, [stage, joined.length]);

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamOn((prev) => {
      const next = !prev;
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  const pickVideo = useCallback(
    (id: string) => {
      setVideoId(id);
      if (status === 'live') void requestMedia({ video: id });
    },
    [status, requestMedia],
  );
  const pickAudio = useCallback(
    (id: string) => {
      setAudioId(id);
      if (status === 'live') void requestMedia({ audio: id });
    },
    [status, requestMedia],
  );

  const sendReaction = useCallback((emoji: string) => {
    const id = ++reactionSeq.current;
    const left = 12 + Math.random() * 76;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    window.setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2600);
    setPickerOpen(false);
  }, []);

  const join = useCallback(() => {
    setStage('call');
    setPickerOpen(false);
  }, []);

  const endCall = useCallback(() => {
    stopStream();
    onClose();
  }, [onClose, stopStream]);

  const total = joined.length + 1;
  const err = ERROR_META[errorKind];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-70 flex flex-col bg-slate-950 text-white"
        >
          {stage === 'lobby' ? (
            /* ===================== LOBBY ===================== */
            <div className="relative flex flex-1 flex-col overflow-y-auto">
              {/* dekorativ fon */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary-500/15 blur-3xl" />
                <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-accent-500/15 blur-3xl" />
              </div>

              <header className="relative flex items-center justify-between px-5 py-4 sm:px-8">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/15 text-primary-400">
                    <Video size={20} variant="Bulk" />
                  </span>
                  <span className="text-sm font-semibold tracking-tight">Hokimiyat konferensiya</span>
                </div>
                <button
                  onClick={endCall}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                  title="Yopish"
                >
                  <CloseCircle size={20} variant="Bulk" />
                </button>
              </header>

              <div className="relative mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-5 py-4 sm:px-8 lg:grid-cols-[1.4fr_1fr]">
                {/* Preview */}
                <div>
                  <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-2xl">
                    {status === 'live' && camOn && hasVideoDevice > 0 ? (
                      <video
                        ref={selfVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full -scale-x-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-linear-to-br from-slate-800 to-slate-900 p-6 text-center">
                        {status === 'requesting' ? (
                          <>
                            <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-primary-400" />
                            <p className="text-sm text-white/60">Kamera va mikrofon yoqilmoqda…</p>
                          </>
                        ) : status === 'error' ? (
                          <PermissionCard
                            err={err}
                            inIframe={inIframe}
                            onRetry={() => void requestMedia()}
                          />
                        ) : (
                          <Avatar name="Siz" color="#10b981" size={84} />
                        )}
                      </div>
                    )}

                    {/* cam off (live) overlay */}
                    {status === 'live' && (!camOn || hasVideoDevice === 0) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-br from-slate-800 to-slate-900">
                        <Avatar name="Siz" color="#10b981" size={84} />
                        <span className="text-xs text-white/50">Kamera o‘chiq</span>
                      </div>
                    )}

                    {/* self label */}
                    <div className="absolute left-3 bottom-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                      Siz
                      {status === 'live' && (
                        <span className="flex items-center gap-1.5 text-white/60">
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full',
                              micOn ? 'bg-primary-500/80' : 'bg-red-500/80',
                            )}
                          >
                            {micOn ? (
                              <Microphone2 size={11} variant="Bold" />
                            ) : (
                              <MicrophoneSlash size={11} variant="Bold" />
                            )}
                          </span>
                          {micOn && <MicMeter level={micLevel} />}
                        </span>
                      )}
                    </div>

                    {/* preview controls */}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-linear-to-t from-black/60 to-transparent pb-3 pt-10">
                      <LobbyMediaButton
                        on={micOn}
                        disabled={status !== 'live'}
                        onToggle={toggleMic}
                        IconOn={Microphone2}
                        IconOff={MicrophoneSlash}
                        devices={audioInputs}
                        selected={audioId}
                        onSelect={pickAudio}
                        emptyLabel="Mikrofon"
                      />
                      <LobbyMediaButton
                        on={camOn}
                        disabled={status !== 'live'}
                        onToggle={toggleCam}
                        IconOn={Video}
                        IconOff={VideoSlash}
                        devices={videoInputs}
                        selected={videoId}
                        onSelect={pickVideo}
                        emptyLabel="Kamera"
                      />
                    </div>
                  </div>
                </div>

                {/* Join panel */}
                <div className="flex flex-col">
                  <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60 ring-1 ring-white/10">
                    <Lock1 size={13} variant="Bulk" /> Xavfsiz ulanish
                  </span>
                  <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                    {title}
                  </h1>
                  {subtitle && <p className="mt-1.5 text-sm text-white/55">{subtitle}</p>}

                  <div className="mt-5 space-y-2.5 text-sm">
                    {schedule && (
                      <div className="flex items-center gap-2.5 text-white/70">
                        <Clock size={17} variant="Bulk" className="text-primary-400" />
                        {schedule}
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-white/70">
                      <People size={17} variant="Bulk" className="text-primary-400" />
                      {participants.length > 0
                        ? `${participants.length} ta ishtirokchi kutilmoqda`
                        : 'Siz birinchi qo\u2018shilyapsiz'}
                    </div>
                  </div>

                  {participants.length > 0 && (
                    <div className="mt-4 flex items-center -space-x-2">
                      {participants.slice(0, 6).map((p) => (
                        <Avatar
                          key={p.id}
                          name={p.name}
                          src={p.photo}
                          color={p.color}
                          size={34}
                          ring
                          className="ring-2 ring-slate-950"
                        />
                      ))}
                      {participants.length > 6 && (
                        <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold ring-2 ring-slate-950">
                          +{participants.length - 6}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-7 space-y-2.5">
                    <button
                      onClick={join}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-primary-500/25 transition-colors hover:bg-primary-600"
                    >
                      <Video size={19} variant="Bulk" />
                      Hozir qo‘shilish
                    </button>
                    {status === 'error' && (
                      <button
                        onClick={join}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/15"
                      >
                        <VideoSlash size={17} variant="Bulk" />
                        Kamerasiz qo‘shilish
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-center text-[11px] text-white/35">
                    Qo‘shilish orqali kamera/mikrofon faqat shu qurilmangizda ishlatiladi.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ===================== CALL ===================== */
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
                      {subtitle ? `${subtitle} \u00B7 ` : ''}
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
                    onClick={() => setPanelOpen((v) => !v)}
                    title="Ishtirokchilar"
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                      panelOpen
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white',
                    )}
                  >
                    <Profile2User size={17} variant="Bulk" />
                  </button>
                  <button
                    onClick={endCall}
                    title="Yopish"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <Maximize4 size={16} />
                  </button>
                </div>
              </div>

              {/* Stage + side panel */}
              <div className="flex flex-1 overflow-hidden">
                <div className="relative flex-1 overflow-y-auto p-3 sm:p-5">
                  <div className={cn('mx-auto grid h-full max-w-6xl auto-rows-fr gap-3', gridCols(total))}>
                    {/* Self */}
                    <Tile speaking={micOn && status === 'live'} highlight>
                      {status === 'live' && camOn && hasVideoDevice > 0 ? (
                        <video
                          ref={selfVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="h-full w-full -scale-x-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-800 to-slate-900">
                          <Avatar name="Siz" color="#10b981" size={72} />
                        </div>
                      )}
                      <TileLabel name="Siz" muted={!micOn} self />
                    </Tile>

                    {/* Joined */}
                    <AnimatePresence>
                      {joined.map((p) => (
                        <motion.div
                          key={p.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                          className="h-full"
                        >
                          <Tile speaking={p.speaking}>
                            {p.camOn && p.photo ? (
                              <motion.img
                                src={p.photo}
                                alt={p.name}
                                className="h-full w-full object-cover"
                                animate={{ scale: [1, 1.06, 1] }}
                                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                              />
                            ) : (
                              <div
                                className="flex h-full w-full items-center justify-center"
                                style={{
                                  background: `linear-gradient(135deg, ${p.color ?? '#334155'}40, #0f172a)`,
                                }}
                              >
                                <Avatar name={p.name} src={p.camOn ? p.photo : undefined} color={p.color} size={64} />
                              </div>
                            )}
                            <TileLabel name={p.name} muted={p.muted} />
                          </Tile>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* sharing banner */}
                  <AnimatePresence>
                    {sharing && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-accent-500/90 px-4 py-2 text-xs font-medium backdrop-blur-sm"
                      >
                        Siz ekraningizni ulashyapsiz
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* join toast */}
                  <AnimatePresence>
                    {toast && !sharing && (
                      <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs font-medium backdrop-blur-sm"
                      >
                        <span className="text-primary-300">{toast.name}</span> qo‘shildi
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* floating reactions */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <AnimatePresence>
                      {reactions.map((r) => (
                        <motion.span
                          key={r.id}
                          initial={{ opacity: 0, y: 0, scale: 0.5 }}
                          animate={{ opacity: [0, 1, 1, 0], y: -220, scale: 1.1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 2.4, ease: 'easeOut' }}
                          className="absolute bottom-2 text-3xl"
                          style={{ left: `${r.left}%` }}
                        >
                          {r.emoji}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* People panel */}
                <AnimatePresence>
                  {panelOpen && (
                    <motion.aside
                      initial={{ x: 320, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 320, opacity: 0 }}
                      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                      className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-slate-900/80 backdrop-blur"
                    >
                      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                        <h4 className="text-sm font-semibold">Ishtirokchilar ({total})</h4>
                        <button
                          onClick={() => setPanelOpen(false)}
                          className="text-white/50 hover:text-white"
                        >
                          <CloseCircle size={18} variant="Bulk" />
                        </button>
                      </div>
                      <div className="flex-1 space-y-1 overflow-y-auto p-2">
                        <PeopleRow name="Siz" self muted={!micOn} camOff={!camOn} color="#10b981" />
                        {joined.map((p) => (
                          <PeopleRow
                            key={p.id}
                            name={p.name}
                            photo={p.photo}
                            color={p.color}
                            role={p.role}
                            muted={p.muted}
                            camOff={!p.camOn}
                            speaking={p.speaking}
                          />
                        ))}
                      </div>
                    </motion.aside>
                  )}
                </AnimatePresence>
              </div>

              {/* Controls */}
              <div className="relative flex items-center justify-center gap-2.5 border-t border-white/10 px-4 py-4 sm:gap-4">
                <ControlButton
                  active={micOn}
                  onClick={toggleMic}
                  label={micOn ? 'Mikrofon' : 'Yoqish'}
                  icon={micOn ? Microphone2 : MicrophoneSlash}
                />
                <ControlButton
                  active={camOn}
                  onClick={toggleCam}
                  label={camOn ? 'Kamera' : 'Yoqish'}
                  icon={camOn ? Video : VideoSlash}
                />
                <ControlButton
                  active={sharing}
                  onClick={() => setSharing((v) => !v)}
                  label="Ekran"
                  icon={Monitor}
                  activeTone="accent"
                />

                {/* reactions */}
                <div className="relative">
                  <ControlButton
                    active={pickerOpen}
                    onClick={() => setPickerOpen((v) => !v)}
                    label="Reaksiya"
                    icon={EmojiHappy}
                    activeTone="accent"
                  />
                  <AnimatePresence>
                    {pickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                        className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1 rounded-2xl bg-slate-800 p-2 shadow-xl ring-1 ring-white/10"
                      >
                        {REACTIONS.map((e) => (
                          <button
                            key={e}
                            onClick={() => sendReaction(e)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-transform hover:scale-125 hover:bg-white/10"
                          >
                            {e}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={endCall}
                  className="flex h-14 items-center gap-2 rounded-full bg-red-500 px-7 font-semibold text-white shadow-lg transition-colors hover:bg-red-600"
                >
                  <CallSlash size={22} variant="Bold" />
                  <span className="hidden sm:inline">Tugatish</span>
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

function PermissionCard({
  err,
  inIframe,
  onRetry,
}: {
  err: (typeof ERROR_META)[MediaErrorKind];
  inIframe: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-3">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
        <Danger size={30} variant="Bulk" />
      </span>
      <h3 className="text-base font-semibold text-white">{err.title}</h3>
      <p className="text-sm text-white/55">{err.desc}</p>
      {err.tips && (
        <ol className="w-full space-y-1.5 rounded-xl bg-white/5 p-3 text-left text-[12.5px] text-white/65">
          {err.tips.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-[11px] font-bold text-primary-300">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ol>
      )}
      {inIframe && (
        <p className="text-[11px] text-amber-300/80">
          Maslahat: sahifani alohida oynada (yangi tab) ochib ko‘ring.
        </p>
      )}
      {err.retry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/20"
        >
          <Refresh2 size={15} /> Qayta urinish
        </button>
      )}
    </div>
  );
}

function MicMeter({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-0.5">
      {[0, 1, 2, 3].map((i) => {
        const active = level > i * 0.22;
        return (
          <span
            key={i}
            className={cn(
              'w-1 rounded-full transition-all duration-100',
              active ? 'bg-primary-400' : 'bg-white/25',
            )}
            style={{ height: `${5 + i * 3}px` }}
          />
        );
      })}
    </span>
  );
}

function LobbyMediaButton({
  on,
  disabled,
  onToggle,
  IconOn,
  IconOff,
  devices,
  selected,
  onSelect,
  emptyLabel,
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  IconOn: typeof Microphone2;
  IconOff: typeof Microphone2;
  devices: MediaDeviceInfo[];
  selected: string;
  onSelect: (id: string) => void;
  emptyLabel: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const Icon = on ? IconOn : IconOff;
  return (
    <div ref={wrapRef} className="relative flex items-center">
      <div
        className={cn(
          'flex items-center rounded-full transition-colors',
          on ? 'bg-white/15' : 'bg-red-500/90',
        )}
      >
        <button
          onClick={onToggle}
          disabled={disabled}
          title={emptyLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white disabled:opacity-40"
        >
          <Icon size={19} variant="Bulk" />
        </button>
        {devices.length > 0 && (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-7 items-center justify-center rounded-r-full text-white/70 hover:text-white"
          >
            <ArrowDown2 size={13} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-14 left-1/2 w-60 -translate-x-1/2 overflow-hidden rounded-xl bg-slate-800 p-1 shadow-xl ring-1 ring-white/10"
          >
            {devices.map((d, i) => (
              <button
                key={d.deviceId || i}
                onClick={() => {
                  onSelect(d.deviceId);
                  setMenuOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-white/10',
                  d.deviceId === selected ? 'text-primary-300' : 'text-white/75',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    d.deviceId === selected ? 'bg-primary-400' : 'bg-white/25',
                  )}
                />
                <span className="truncate">{d.label || `${emptyLabel} ${i + 1}`}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tile({
  children,
  speaking = false,
  highlight = false,
}: {
  children: React.ReactNode;
  speaking?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative h-full min-h-35 overflow-hidden rounded-2xl bg-slate-800 ring-2 transition-all duration-300',
        speaking ? 'ring-primary-400' : highlight ? 'ring-white/15' : 'ring-transparent',
      )}
      style={speaking ? { boxShadow: '0 0 0 4px rgba(16,185,129,0.25)' } : undefined}
    >
      {children}
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

function PeopleRow({
  name,
  photo,
  color,
  role,
  muted,
  camOff,
  speaking = false,
  self = false,
}: {
  name: string;
  photo?: string;
  color?: string;
  role?: string;
  muted: boolean;
  camOff: boolean;
  speaking?: boolean;
  self?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors',
        speaking ? 'bg-primary-500/15' : 'hover:bg-white/5',
      )}
    >
      <Avatar name={name} src={photo} color={color} size={34} ring={speaking} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-medium text-white">
          {name}
          {self && <span className="ml-1 text-white/40">(siz)</span>}
        </div>
        {role && <div className="truncate text-[11px] text-white/45">{role}</div>}
      </div>
      <div className="flex items-center gap-1">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full',
            muted ? 'text-red-400' : 'text-white/55',
          )}
        >
          {muted ? <MicrophoneSlash size={14} variant="Bulk" /> : <Microphone2 size={14} variant="Bulk" />}
        </span>
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full',
            camOff ? 'text-red-400' : 'text-white/55',
          )}
        >
          {camOff ? <VideoSlash size={14} variant="Bulk" /> : <Video size={14} variant="Bulk" />}
        </span>
      </div>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  active,
  onClick,
  activeTone = 'neutral',
}: {
  icon: typeof Microphone2;
  label: string;
  active: boolean;
  onClick: () => void;
  activeTone?: 'neutral' | 'accent';
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5" title={label}>
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
          !active
            ? 'bg-red-500/90 text-white hover:bg-red-500'
            : activeTone === 'accent'
              ? 'bg-accent-500 text-white hover:bg-accent-600'
              : 'bg-white/10 text-white hover:bg-white/20',
        )}
      >
        <Icon size={21} variant="Bulk" />
      </span>
      <span className="text-[10.5px] font-medium text-white/60">{label}</span>
    </button>
  );
}
