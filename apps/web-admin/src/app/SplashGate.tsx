import { type ReactNode, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SplashScreen } from './SplashScreen';

/**
 * Ilova har ochilganda animatsiyali splash ko'rsatadi,
 * so'ng asosiy interfeysni (login yoki panel) ochadi.
 */
export function SplashGate({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AnimatePresence>{show && <SplashScreen />}</AnimatePresence>
      {children}
    </>
  );
}
