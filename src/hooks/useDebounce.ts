import { useEffect, useState } from 'react';

/**
 * Debounces a rapidly changing value by `delayMs` milliseconds,
 * clearing pending timers on value updates and component unmount.
 */
export function useDebounce<T>(value: T, delayMs = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebouncedValue(value);
      return;
    }

    const timerId: ReturnType<typeof setTimeout> = globalThis.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      globalThis.clearTimeout(timerId);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
