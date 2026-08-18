import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, Gallery, Microphone2, Send2, Trash, InfoCircle } from 'iconsax-react';
import { usePrefersReducedMotion } from './useChat';
import { api } from '@/shared/api/client';

/* Suhbat uchun xabar yozish paneli: matn, fayl, rasm va ovozli xabar. */

const fmtRec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** POST /uploads javobi — mahalliy faylni doimiy (durable) URL'ga aylantiradi. */
type UploadResult = { url: string; fileName: string; fileSize: number; mimeType: string; durationSec?: number };

/** Fayl kengaytmasini MediaRecorder mimeType'idan chiqaradi (voice fayl nomi uchun). */
function voiceExt(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export function ChatComposer({
  onSendText,
  onSendVoice,
  onSendFile,
  onTyping,
  disabled = false,
}: {
  onSendText: (text: string) => void;
  onSendVoice: (url: string, durationSec: number) => void;
  onSendFile: (url: string, kind: 'image' | 'file', name: string, size: number) => void;
  /** Jonli "yozmoqda…" — matn o'zgarganda chaqiriladi (debounce ichkarida). */
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
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

  // Yozib olish taymeri
  useEffect(() => {
    if (!recording) return;
    const iv = window.setInterval(() => setSeconds(Math.round((Date.now() - startRef.current) / 1000)), 250);
    return () => window.clearInterval(iv);
  }, [recording]);

  // Unmount — mikrofonni o'chirish
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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
        {recording ? (
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
              disabled={uploading}
              title="Fayl biriktirish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Paperclip size={21} />
            </button>
            <button
              onClick={() => imageRef.current?.click()}
              disabled={uploading}
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
              <button
                onClick={startRecording}
                disabled={uploading}
                title="Ovozli xabar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-glow transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Microphone2 size={19} variant="Bold" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
