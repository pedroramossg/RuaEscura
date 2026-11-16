import { useState, useCallback } from 'react';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 12,
  success: [15, 60, 20],
  warning: [25, 60, 25],
  error: [30, 50, 30, 50, 40],
};

const STORAGE_KEY = 'ruaescura_haptics_enabled';

export function useHaptics() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, String(value));
      } catch {
        // Safe no-op on private browsing/storage quotas
      }
    }
  }, []);

  const trigger = useCallback(
    (kind: HapticKind) => {
      if (!enabled) return;
      if (typeof window === 'undefined') return;

      // Honor prefers-reduced-motion
      try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return;
        }
      } catch {
        // safe fallback
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          const pattern = HAPTIC_PATTERNS[kind];
          navigator.vibrate(pattern);
        } catch {
          // safe fallback
        }
      }
    },
    [enabled]
  );

  return {
    enabled,
    setEnabled,
    trigger,
  };
}
