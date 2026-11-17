import { useReducedMotion } from 'motion/react';

/**
 * Shared reduced-motion check combining Framer Motion's hook with a safe
 * matchMedia fallback for non-browser/test environments.
 */
export function usePrefersReducedMotion(): boolean {
  const motionPref = useReducedMotion();
  const mediaPref =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  return Boolean(motionPref || mediaPref);
}

