import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Call,
  CallSlash,
  Microphone2,
  MicrophoneSlash,
  Video,
  VideoSlash,
  Danger,
} from 'iconsax-react';
import { Avatar } from './Avatar';
import { cn } from '@/shared/lib/cn';
import { useCall, type CallEndReason } from '@/shared/realtime/CallProvider';

/* ============================================================
   Butun ilova bo'ylab qo'ng'iroq ustki oynasi (real WebRTC).
   useCall() holat mashinasidan boshqariladi:
   - incoming: jiringlash (qabul / rad)
   - outgoing: "Chaqirilmoqda…" (bekor qilish)
   - connecting/active: uzoq video to'liq ekran + mahalliy PiP (video),
     yoki avatarlar (audio) + mute/kamera/tugatish boshqaruvlari + taymer
   - ended: sabab bilan qisqa xabar (o'zi yopiladi)
   Vizual til VideoCall.tsx bilan bir xil (slate-950 fon, dumaloq boshqaruvlar).
   ============================================================ */

const REASON_LABEL: Record<CallEndReason, string> = {
  ended: "Qo'ng'iroq yakunlandi",
  rejected: "Qo'ng'iroq rad etildi",
  busy: 'Abonent band',
  missed: 'Javob berilmadi',
  cancelled: "Qo'ng'iroq bekor qilindi",
  failed: "Ulanib bo'lmadi",
  error: 'Xatolik',
};

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mm}` : mm;
}

/** <video> ga MediaStream'ni srcObject orqali ulaydi (atribut sifatida bo'lmaydi). */
function StreamVideo({
  stream,
  muted,
  mirror,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn(mirror && '-scale-x-100', className)}
    />
  );
}

/** Audio-only qo'ng'iroqda uzoq tomon ovozini eshittirish uchun ko'rinmas element. */
function StreamAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

function RoundButton({
  onClick,
  tone,
  label,
  children,
}: {
  onClick: () => void;
  tone: 'neutral' | 'danger' | 'success';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-colors',
        tone === 'danger' && 'bg-red-500 hover:bg-red-600',
        tone === 'success' && 'bg-emerald-500 hover:bg-emerald-600',
        tone === 'neutral' && 'bg-white/15 hover:bg-white/25',
      )}
    >
      {children}
    </button>
  );
}

export function CallOverlay() {
  const {
    phase,
    peer,
    localStream,
    remoteStream,
    muted,
    camOff,
    durationSec,
    error,
    endReason,
    accept,
    reject,
    cancel,
    hangup,
    toggleMute,
    toggleCam,
    dismiss,
  } = useCall();

  const open = phase !== 'idle';
  const media = peer?.media ?? 'audio';
  const isVideo = media === 'video';
  const inCall = phase === 'connecting' || phase === 'active';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="call-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] flex flex-col bg-slate-950 text-white"
        >
          {/* ---------------- INCOMING (jiringlamoqda) ---------------- */}
          {phase === 'incoming' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
              <div className="relative">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/30" />
                <span className="absolute -inset-3 animate-pulse rounded-full bg-primary-500/10" />
                <Avatar name={peer?.name ?? 'Qo‘ng‘iroq'} src={peer?.avatar} size={112} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{peer?.name ?? 'Noma’lum'}</h2>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/60">
                  {isVideo ? <Video size={16} variant="Bulk" /> : <Call size={16} variant="Bulk" />}
                  {isVideo ? 'Video' : 'Audio'} qo‘ng‘iroq…
                </p>
              </div>
              <div className="mt-4 flex items-center gap-10">
                <div className="flex flex-col items-center gap-2">
                  <RoundButton onClick={reject} tone="danger" label="Rad etish">
                    <CallSlash size={24} variant="Bold" />
                  </RoundButton>
                  <span className="text-xs text-white/50">Rad etish</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <RoundButton onClick={accept} tone="success" label="Qabul qilish">
                    {isVideo ? <Video size={24} variant="Bold" /> : <Call size={24} variant="Bold" />}
                  </RoundButton>
                  <span className="text-xs text-white/50">Qabul qilish</span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- OUTGOING (chaqirilmoqda) ---------------- */}
          {phase === 'outgoing' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
              <div className="relative">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/25" />
                <Avatar name={peer?.name ?? 'Qo‘ng‘iroq'} src={peer?.avatar} size={112} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{peer?.name ?? 'Noma’lum'}</h2>
                <p className="mt-1 text-sm text-white/60">Chaqirilmoqda…</p>
              </div>
              <div className="mt-4 flex flex-col items-center gap-2">
                <RoundButton onClick={cancel} tone="danger" label="Bekor qilish">
                  <CallSlash size={24} variant="Bold" />
                </RoundButton>
                <span className="text-xs text-white/50">Bekor qilish</span>
              </div>
            </div>
          )}

          {/* ---------------- CONNECTING / ACTIVE ---------------- */}
          {inCall && (
            <>
              {isVideo ? (
                <div className="relative flex-1 overflow-hidden bg-black">
                  {/* Uzoq tomon (to'liq ekran) */}
                  {remoteStream ? (
                    <StreamVideo stream={remoteStream} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-800 to-slate-950">
                      <Avatar name={peer?.name ?? '—'} src={peer?.avatar} size={112} />
                    </div>
                  )}

                  {/* Yuqori holat paneli */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-linear-to-b from-black/60 to-transparent px-5 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{peer?.name}</h3>
                      <p className="text-xs text-white/70">
                        {phase === 'active' ? fmt(durationSec) : 'Ulanmoqda…'}
                      </p>
                    </div>
                  </div>

                  {/* Mahalliy PiP */}
                  <div className="absolute right-4 top-4 h-40 w-28 overflow-hidden rounded-2xl bg-slate-800 shadow-xl ring-1 ring-white/15 sm:h-44 sm:w-32">
                    {localStream && !camOff ? (
                      <StreamVideo
                        stream={localStream}
                        muted
                        mirror
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-700 to-slate-900">
                        <Avatar name="Siz" color="#10b981" size={48} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Audio-only: avatarlar */
                <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
                  <Avatar name={peer?.name ?? '—'} src={peer?.avatar} size={128} />
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{peer?.name}</h2>
                    <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/60">
                      <Call size={15} variant="Bulk" />
                      {phase === 'active' ? fmt(durationSec) : 'Ulanmoqda…'}
                    </p>
                  </div>
                  <StreamAudio stream={remoteStream} />
                </div>
              )}

              {/* Boshqaruvlar */}
              <div className="flex items-center justify-center gap-4 border-t border-white/10 bg-slate-950 px-4 py-5">
                <div className="flex flex-col items-center gap-1.5">
                  <RoundButton
                    onClick={toggleMute}
                    tone={muted ? 'danger' : 'neutral'}
                    label={muted ? 'Mikrofonni yoqish' : 'Mikrofonni o‘chirish'}
                  >
                    {muted ? (
                      <MicrophoneSlash size={22} variant="Bold" />
                    ) : (
                      <Microphone2 size={22} variant="Bulk" />
                    )}
                  </RoundButton>
                  <span className="text-[10.5px] text-white/50">{muted ? 'Yoqish' : 'Mikrofon'}</span>
                </div>

                {isVideo && (
                  <div className="flex flex-col items-center gap-1.5">
                    <RoundButton
                      onClick={toggleCam}
                      tone={camOff ? 'danger' : 'neutral'}
                      label={camOff ? 'Kamerani yoqish' : 'Kamerani o‘chirish'}
                    >
                      {camOff ? (
                        <VideoSlash size={22} variant="Bold" />
                      ) : (
                        <Video size={22} variant="Bulk" />
                      )}
                    </RoundButton>
                    <span className="text-[10.5px] text-white/50">{camOff ? 'Yoqish' : 'Kamera'}</span>
                  </div>
                )}

                <div className="flex flex-col items-center gap-1.5">
                  <RoundButton onClick={hangup} tone="danger" label="Tugatish">
                    <CallSlash size={24} variant="Bold" />
                  </RoundButton>
                  <span className="text-[10.5px] text-white/50">Tugatish</span>
                </div>
              </div>
            </>
          )}

          {/* ---------------- ENDED / xatolik ---------------- */}
          {phase === 'ended' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
              <span
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-2xl',
                  endReason === 'error' || endReason === 'failed'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-white/10 text-white/70',
                )}
              >
                {endReason === 'error' || endReason === 'failed' ? (
                  <Danger size={30} variant="Bulk" />
                ) : (
                  <CallSlash size={28} variant="Bulk" />
                )}
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  {endReason ? REASON_LABEL[endReason] : "Qo'ng'iroq tugadi"}
                </h2>
                {peer?.name && <p className="mt-0.5 text-sm text-white/55">{peer.name}</p>}
                {error && <p className="mt-2 max-w-sm text-sm text-white/60">{error}</p>}
                {endReason === 'ended' && durationSec > 0 && (
                  <p className="mt-1 text-sm text-white/50">Davomiyligi: {fmt(durationSec)}</p>
                )}
              </div>
              <button
                onClick={dismiss}
                className="mt-1 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20"
              >
                Yopish
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
