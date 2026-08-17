import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, Gallery, Microphone2, Send2, Trash } from 'iconsax-react';
import { usePrefersReducedMotion } from './useChat';

/* Suhbat uchun xabar yozish paneli: matn, fayl, rasm va ovozli xabar. */

const fmtRec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function ChatComposer({
  onSendText,
  onSendVoice,
  onSendFile,
  disabled = false,
}: {
  onSendText: (text: string) => void;
  onSendVoice: (url: string, durationSec: number) => void;
  onSendFile: (url: string, kind: 'image' | 'file', name: string, size: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const panelTransition = { duration: prefersReducedMotion ? 0 : 0.2 };

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

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'file') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const resolved: 'image' | 'file' = file.type.startsWith('image/') ? 'image' : kind;
    onSendFile(url, resolved, file.name, file.size);
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
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        onSendVoice(URL.createObjectURL(blob), dur);
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
              title="Fayl biriktirish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Paperclip size={21} />
            </button>
            <button
              onClick={() => imageRef.current?.click()}
              title="Rasm biriktirish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Gallery size={21} />
            </button>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
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
                title="Ovozli xabar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-glow transition-colors hover:bg-primary-700"
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
