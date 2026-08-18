import { useEffect, useState } from 'react';

/**
 * OS/brauzer darajasidagi "kamroq animatsiya" (prefers-reduced-motion)
 * sozlamasini kuzatadi. Kirish animatsiyalarini shunga qarab
 * o'chirish/qisqartirish uchun ishlatiladi.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
