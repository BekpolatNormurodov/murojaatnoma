import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Animates a number from its previous value to `target` (ease-out, ~0.8 s).
 * Returns the value as-is when the user prefers reduced motion.
 */
export function useCountUp(target: number | undefined, durationMs = 800): number | undefined {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | undefined>(undefined);
  const from = useRef(0);

  useEffect(() => {
    if (target === undefined || reduce) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (target - a) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduce]);

  if (reduce || target === undefined) return target;
  return shown ?? 0;
}
