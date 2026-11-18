import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Smoothly animates a numeric readout toward `target` using cubic ease-out,
 * snapping immediately when `prefers-reduced-motion` is enabled.
 */
export function useAnimatedNumber(target: number, durationMs = 520): number {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState<number>(target);
  const currentRef = useRef<number>(target);

  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined') {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    const startValue = currentRef.current;
    const delta = target - startValue;
    if (delta === 0) return;

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Cubic ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startValue + delta * eased);
      currentRef.current = next;
      setDisplay(next);

      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setDisplay(target);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [target, durationMs, prefersReducedMotion]);

  return display;
}
