import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, Gallery, Microphone2, VideoCircle, Send2, Trash, InfoCircle } from 'iconsax-react';
import { usePrefersReducedMotion } from './useChat';
import { api } from '@/shared/api/client';
import { cn } from '@/shared/lib/cn';

/* Suhbat uchun xabar yozish paneli: matn, fayl, rasm, ovozli va dumaloq video xabar. */

const fmtRec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Dumaloq video xabar (kружочек) uchun eng katta uzunlik — Telegram kabi 60s. */
const MAX_VIDEO_NOTE_SEC = 60;

/** POST /uploads javobi — mahalliy faylni doimiy (durable) URL'ga aylantiradi. */
type UploadResult = { url: string; fileName: string; fileSize: number; mimeType: string; durationSec?: number };

/** Fayl kengaytmasini MediaRecorder mimeType'idan chiqaradi (voice fayl nomi uchun). */
function voiceExt(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Video xabar uchun MediaRecorder qo'llab-quvvatlaydigan eng mos mimeType'ni tanlaydi. */
function pickVideoMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const candidates = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

/** Fayl kengaytmasini video mimeType'idan chiqaradi (video-note fayl nomi uchun). */
function videoExt(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

export function ChatComposer({
  onSendText,
  onSendVoice,
  onSendVideo,
  onSendFile,
  onTyping,
  disabled = false,
}: {
  onSendText: (text: string) => void;
  onSendVoice: (url: string, durationSec: number) => void;
  onSendVideo: (url: string, durationSec: number) => void;
  onSendFile: (url: string, kind: 'image' | 'file', name: string, size: number) => void;
  /** Jonli "yozmoqda…" — matn o'zgarganda chaqiriladi (debounce ichkarida). */
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // Faylni serverga yuklash holati — yuklanayotganda tugmalar bloklanadi va
  // xatolik bo'lsa qisqa ogohlantirish ko'rsatiladi (blob: URL o'rniga endi
  // POST /uploads orqali doimiy URL olamiz — shunda rasm/ovoz boshqa
  // qurilmalarda ham ochiladi).
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const panelTransition = { duration: prefersReducedMotion ? 0 : 0.2 };

  // Xatolik xabarini bir necha soniyadan so'ng avtomatik yashiramiz.
  useEffect(() => {
    if (!uploadError) return;
    const t = window.setTimeout(() => setUploadError(null), 4000);
    return () => window.clearTimeout(t);
  }, [uploadError]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const cancelledRef = useRef(false);

  // Dumaloq video xabar (video-note) uchun alohida holat/refs — ovozdan
  // mustaqil, chunki ikkalasi bir vaqtda ishlamaydi lekin turli media turi.
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoStartRef = useRef(0);
  const videoCancelledRef = useRef(false);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Yozib olish taymeri
  useEffect(() => {
    if (!recording) return;
    const iv = window.setInterval(() => setSeconds(Math.round((Date.now() - startRef.current) / 1000)), 250);
    return () => window.clearInterval(iv);
  }, [recording]);

  // Video-note preview'ini ulash. <video> elementi faqat videoRecording=true
  // bo'lganda render bo'ladi, shuning uchun stream'ni getUserMedia paytida
  // emas (o'shanda ref hali null), element mount bo'lgach — bu effekt orqali
  // ulaymiz. Aks holda doira qora qolardi.
  useEffect(() => {
    const el = videoPreviewRef.current;
    const stream = videoStreamRef.current;
    if (videoRecording && el && stream) {
      el.srcObject = stream;
      void el.play().catch(() => {});
    }
  }, [videoRecording]);

  // Unmount — mikrofon/kamerani o'chirish
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopVideoStream = () => {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
  };

  const typingStopRef = useRef<number | undefined>(undefined);
  // Matn o'zgarganda "yozmoqda" signalini yuboramiz; 1.5s tinchlikdan so'ng
  // "to'xtadi" signalini yuboramiz (debounce).
  const handleTextChange = (v: string) => {
    setText(v);
    if (!onTyping) return;
    onTyping(true);
    window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(() => onTyping(false), 1500);
  };

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
    onTyping?.(false);
    window.clearTimeout(typingStopRef.current);
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'file') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const resolved: 'image' | 'file' = file.type.startsWith('image/') ? 'image' : kind;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await api.upload<UploadResult>('/uploads', fd);
      onSendFile(res.url, resolved, res.fileName, res.fileSize);
    } catch {
      setUploadError('Faylni yuklab bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
        stopStream();
        if (cancelledRef.current) return;
        const mime = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        // Ovozli xabarni ham serverga yuklaymiz (durable URL) — aks holda u
        // faqat yuboruvchining brauzerida eshitilardi.
        setUploading(true);
        setUploadError(null);
        const fd = new FormData();
        fd.append('file', blob, `voice-${dur}s.${voiceExt(mime)}`);
        fd.append('durationSec', String(dur));
        api
          .upload<UploadResult>('/uploads', fd)
          .then((res) => onSendVoice(res.url, res.durationSec ?? dur))
          .catch(() => setUploadError('Ovozli xabarni yuklab bo‘lmadi.'))
          .finally(() => setUploading(false));
      };
      recorderRef.current = rec;
      startRef.current = Date.now();
      setSeconds(0);
      rec.start();
      setRecording(true);
    } catch {
      /* mikrofon ruxsati berilmadi */
    }
  };

  const finishRecording = () => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
    setRecording(false);
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
    setRecording(false);
  };

  const startVideoRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
        audio: true,
      });
      videoStreamRef.current = stream;
      // Preview <video> hali render bo'lmagan (videoRecording=false) — stream
      // element mount bo'lgach yuqoridagi effekt orqali ulanadi.
      const mime = pickVideoMimeType();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      videoChunksRef.current = [];
      videoCancelledRef.current = false;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) videoChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const dur = Math.max(1, Math.round((Date.now() - videoStartRef.current) / 1000));
        stopVideoStream();
        if (videoCancelledRef.current) return;
        const blobMime = rec.mimeType || mime || 'video/webm';
        const blob = new Blob(videoChunksRef.current, { type: blobMime });
        // Video-note'ni ham serverga yuklaymiz (durable URL) — aks holda u
        // faqat yuboruvchining brauzerida ko'rinardi.
        setUploading(true);
        setUploadError(null);
        const fd = new FormData();
        fd.append('file', blob, `video-note-${dur}s.${videoExt(blobMime)}`);
        fd.append('durationSec', String(dur));
        api
          .upload<UploadResult>('/uploads', fd)
          .then((res) => onSendVideo(res.url, res.durationSec ?? dur))
          .catch(() => setUploadError('Video xabarni yuklab bo‘lmadi.'))
          .finally(() => setUploading(false));
      };
      videoRecorderRef.current = rec;
      videoStartRef.current = Date.now();
      setSeconds(0);
      rec.start();
      setVideoRecording(true);
    } catch {
      /* kamera/mikrofon ruxsati berilmadi */
    }
  };

  const finishVideoRecording = () => {
    videoCancelledRef.current = false;
    videoRecorderRef.current?.stop();
    setVideoRecording(false);
  };

  const cancelVideoRecording = () => {
    videoCancelledRef.current = true;
    videoRecorderRef.current?.stop();
    setVideoRecording(false);
  };

  // Video-note yozib olish taymeri — 60s'da avtomatik to'xtaydi.
  useEffect(() => {
    if (!videoRecording) return;
    const iv = window.setInterval(() => {
      const s = Math.round((Date.now() - videoStartRef.current) / 1000);
      setSeconds(s);
      if (s >= MAX_VIDEO_NOTE_SEC) finishVideoRecording();
    }, 250);
    return () => window.clearInterval(iv);
  }, [videoRecording]);

  if (disabled) return null;

  return (
    <div className="border-t border-line bg-surface px-3 py-3 sm:px-4">
      <input ref={fileRef} type="file" hidden onChange={(e) => pickFile(e, 'file')} />
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e, 'image')} />

      {(uploading || uploadError) && (
        <div className="mb-2 flex items-center gap-2 px-1">
          {uploading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              <span className="text-[12.5px] font-medium text-ink-soft">Yuklanmoqda…</span>
            </>
          ) : (
            <>
              <InfoCircle size={16} variant="Bulk" className="text-danger" />
              <span className="text-[12.5px] font-medium text-danger">{uploadError}</span>
            </>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {videoRecording ? (
          <motion.div
            key="video-rec"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={panelTransition}
            className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-danger-soft px-3 py-4"
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-sm font-medium text-red-700">
                Video yozilmoqda… {fmtRec(seconds)} / {fmtRec(MAX_VIDEO_NOTE_SEC)}
              </span>
            </span>

            {/* Dumaloq jonli self-preview — Telegram "кружочек" uslubi */}
            <div className="relative h-[220px] w-[220px] shrink-0">
              <span
                className={cn(
                  'absolute inset-0 rounded-full ring-4 ring-red-500',
                  !prefersReducedMotion && 'animate-pulse',
                )}
              />
              <div className="absolute inset-1.5 overflow-hidden rounded-full bg-black">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={cancelVideoRecording}
                title="Bekor qilish"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash size={18} variant="Bulk" />
              </button>
              <button
                onClick={finishVideoRecording}
                title="Yuborish"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700"
              >
                <Send2 size={17} variant="Bold" />
              </button>
            </div>
          </motion.div>
        ) : recording ? (
          <motion.div
            key="rec"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={panelTransition}
            className="flex items-center gap-3 rounded-2xl border border-red-200 bg-danger-soft px-3 py-2"
          >
            <button
              onClick={cancelRecording}
              title="Bekor qilish"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash size={18} variant="Bulk" />
            </button>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="flex-1 text-sm font-medium text-red-700">
              Yozilmoqda… {fmtRec(seconds)}
            </span>
            {/* jonli to'lqin */}
            <div className="flex h-6 items-center gap-0.5">
              {Array.from({ length: 18 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="w-0.5 rounded-full bg-red-400"
                  animate={
                    prefersReducedMotion
                      ? { height: 6 + ((i * 7) % 16) }
                      : { height: [4, 6 + ((i * 7) % 16), 4] }
                  }
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.8, repeat: Infinity, delay: i * 0.05 }
                  }
                />
              ))}
            </div>
            <button
              onClick={finishRecording}
              title="Yuborish"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700"
            >
              <Send2 size={17} variant="Bold" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={panelTransition}
            className="flex items-end gap-2"
          >
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || recording || videoRecording}
              title="Fayl biriktirish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Paperclip size={21} />
            </button>
            <button
              onClick={() => imageRef.current?.click()}
              disabled={uploading || recording || videoRecording}
              title="Rasm biriktirish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Gallery size={21} />
            </button>

            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              rows={1}
              placeholder="Xabar yozing…"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary-300"
            />

            {text.trim() ? (
              <button
                onClick={sendText}
                title="Yuborish"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-glow transition-colors hover:bg-primary-700"
              >
                <Send2 size={19} variant="Bold" />
              </button>
            ) : (
              <>
                <button
                  onClick={startVideoRecording}
                  disabled={uploading || recording || videoRecording}
                  title="Dumaloq video xabar"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <VideoCircle size={21} />
                </button>
                <button
                  onClick={startRecording}
                  disabled={uploading || recording || videoRecording}
                  title="Ovozli xabar"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-glow transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Microphone2 size={19} variant="Bold" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
