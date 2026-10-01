import { type ReactNode, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SplashScreen } from './SplashScreen';

const SEEN_KEY = 'splash-seen';
const SPLASH_MS = 1200;

/** Show the splash once per browser session, never for reduced-motion users. */
function shouldShowSplash(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

/**
 * Brend splash — sessiyada BIR MARTA va qisqa (1.2 s). Ilgari har sahifa
 * yangilanganda 3 s (+0.6 s chiqish) to'liq ekranni to'sib turardi: har F5,
 * har yangi tab yoki to'g'ridan-to'g'ri havola ~4 s kutish edi.
 */
export function SplashGate({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(shouldShowSplash);

  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode — splash simply shows again next load */
    }
    const t = setTimeout(() => setShow(false), SPLASH_MS);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <>
      <AnimatePresence>{show && <SplashScreen />}</AnimatePresence>
      {children}
    </>
  );
}
