export type WebVitalName = 'LCP' | 'FCP' | 'CLS' | 'INP';

export const SLOW_OPERATION_THRESHOLD_MS = 200;
const MAX_SLOW_EVENTS = 100;
const MAX_METRIC_NAME_LENGTH = 120;

export interface PerfMetricStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  lastMs: number;
  slowCount: number;
}

export interface SlowPerfEvent {
  name: string;
  durationMs: number;
  recordedAt: number;
}

export interface PerfSnapshot {
  readonly vitals: Readonly<Partial<Record<WebVitalName, number>>>;
  readonly metrics: Readonly<Record<string, Readonly<PerfMetricStats>>>;
  readonly slowOperations: ReadonlyArray<Readonly<SlowPerfEvent>>;
  readonly totalRecorded: number;
  readonly slowCount: number;
}

export interface PerfSpan {
  (): number;
  end: () => number;
  cancel: () => void;
}

interface InternalMetricStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
  slowCount: number;
}

const vitalsStore: Partial<Record<WebVitalName, number>> = {};
const metricsStore = new Map<string, InternalMetricStats>();
const slowOperationsStore: SlowPerfEvent[] = [];
let totalRecordedCount = 0;
let totalSlowCount = 0;
let activeObservers: PerformanceObserver[] = [];
let observersInitialized = false;

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function sanitizeMetricName(rawName: string): string {
  const trimmed = String(rawName || 'unknown').trim();
  // Strip query parameters and fragments so sensitive tokens/PII never enter local telemetry
  const sanitized = trimmed.split('?')[0].split('#')[0].slice(0, MAX_METRIC_NAME_LENGTH);
  return sanitized || 'unknown';
}

/**
 * Records a local Web Vital measurement (LCP, FCP, CLS, INP) with zero PII.
 */
export function recordWebVital(name: WebVitalName, value: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  if (name === 'CLS') {
    vitalsStore.CLS = Number(((vitalsStore.CLS ?? 0) + value).toFixed(4));
    return;
  }
  if (name === 'INP') {
    vitalsStore.INP = Math.max(vitalsStore.INP ?? 0, value);
    return;
  }
  vitalsStore[name] = value;
}

/**
 * Records a completed operation duration in milliseconds and flags slow spans (> 200ms).
 */
export function recordPerfMetric(name: string, durationMs: number): void {
  if (!Number.isFinite(durationMs)) return;

  const safeName = sanitizeMetricName(name);
  const clampedMs = Math.max(0, Number(durationMs.toFixed(3)));
  const isSlow = clampedMs > SLOW_OPERATION_THRESHOLD_MS;

  totalRecordedCount += 1;

  const existing = metricsStore.get(safeName);
  if (existing) {
    existing.count += 1;
    existing.totalMs += clampedMs;
    existing.minMs = Math.min(existing.minMs, clampedMs);
    existing.maxMs = Math.max(existing.maxMs, clampedMs);
    existing.lastMs = clampedMs;
    if (isSlow) existing.slowCount += 1;
  } else {
    metricsStore.set(safeName, {
      count: 1,
      totalMs: clampedMs,
      minMs: clampedMs,
      maxMs: clampedMs,
      lastMs: clampedMs,
      slowCount: isSlow ? 1 : 0,
    });
  }

  if (isSlow) {
    totalSlowCount += 1;
    slowOperationsStore.push({
      name: safeName,
      durationMs: clampedMs,
      recordedAt: Date.now(),
    });
    if (slowOperationsStore.length > MAX_SLOW_EVENTS) {
      slowOperationsStore.shift();
    }
  }
}

/**
 * Starts a local zero-PII performance span. Call the returned handle (or `.end()`) when done.
 */
export function startPerfSpan(name: string): PerfSpan {
  const safeName = sanitizeMetricName(name);
  const startedAt = nowMs();
  let settled = false;
  let recordedDuration = 0;

  const finish = (): number => {
    if (settled) return recordedDuration;
    settled = true;
    recordedDuration = Math.max(0, Number((nowMs() - startedAt).toFixed(3)));
    recordPerfMetric(safeName, recordedDuration);
    return recordedDuration;
  };

  const cancel = (): void => {
    settled = true;
  };

  return Object.assign(finish, { end: finish, cancel });
}

function observeEntryType(
  entryType: string,
  onEntries: (entries: PerformanceEntryList) => void,
  options?: PerformanceObserverInit
): void {
  if (typeof PerformanceObserver === 'undefined') return;

  const supported = (
    PerformanceObserver as unknown as { supportedEntryTypes?: ReadonlyArray<string> }
  ).supportedEntryTypes;

  if (Array.isArray(supported) && !supported.includes(entryType)) {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      onEntries(list.getEntries());
    });
    observer.observe(options ?? { type: entryType, buffered: true });
    activeObservers.push(observer);
  } catch {
    // Gracefully skip unsupported PerformanceObserver entry types (e.g. JSDOM / older Safari)
  }
}

/**
 * Initializes guarded Web Vitals observers (LCP, FCP, CLS, INP).
 * Safe to invoke in JSDOM or browsers missing PerformanceObserver.
 */
export function initPerfObservers(): () => void {
  if (observersInitialized) {
    return disconnectPerfObservers;
  }
  observersInitialized = true;

  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    try {
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-contentful-paint') {
          recordWebVital('FCP', entry.startTime);
        }
      }
    } catch {
      // Ignore paint API failures in minimal runtimes
    }
  }

  observeEntryType('paint', (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') {
        recordWebVital('FCP', entry.startTime);
      }
    }
  });

  observeEntryType('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last) {
      recordWebVital('LCP', last.startTime);
    }
  });

  observeEntryType('layout-shift', (entries) => {
    for (const entry of entries) {
      const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
      if (!shift.hadRecentInput && typeof shift.value === 'number') {
        recordWebVital('CLS', shift.value);
      }
    }
  });

  observeEntryType(
    'event',
    (entries) => {
      for (const entry of entries) {
        const eventEntry = entry as PerformanceEntry & { interactionId?: number };
        if (eventEntry.interactionId && eventEntry.duration > 0) {
          recordWebVital('INP', eventEntry.duration);
        }
      }
    },
    { type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit
  );

  return disconnectPerfObservers;
}

function disconnectPerfObservers(): void {
  for (const observer of activeObservers) {
    try {
      observer.disconnect();
    } catch {
      // Ignore observer cleanup errors
    }
  }
  activeObservers = [];
  observersInitialized = false;
}

/**
 * Returns an immutable, aggregated read-only snapshot of Web Vitals and span metrics.
 */
export function getPerfSnapshot(): PerfSnapshot {
  const metricsRecord: Record<string, Readonly<PerfMetricStats>> = {};
  for (const [key, stats] of metricsStore.entries()) {
    metricsRecord[key] = Object.freeze({
      count: stats.count,
      totalMs: Number(stats.totalMs.toFixed(3)),
      minMs: stats.minMs,
      maxMs: stats.maxMs,
      avgMs: Number((stats.totalMs / stats.count).toFixed(3)),
      lastMs: stats.lastMs,
      slowCount: stats.slowCount,
    });
  }

  const slowList = slowOperationsStore.map((item) => Object.freeze({ ...item }));

  return Object.freeze({
    vitals: Object.freeze({ ...vitalsStore }),
    metrics: Object.freeze(metricsRecord),
    slowOperations: Object.freeze(slowList),
    totalRecorded: totalRecordedCount,
    slowCount: totalSlowCount,
  });
}

/**
 * Clears recorded telemetry and disconnects observers (primarily for tests).
 */
export function resetPerfMonitor(): void {
  disconnectPerfObservers();
  delete vitalsStore.LCP;
  delete vitalsStore.FCP;
  delete vitalsStore.CLS;
  delete vitalsStore.INP;
  metricsStore.clear();
  slowOperationsStore.length = 0;
  totalRecordedCount = 0;
  totalSlowCount = 0;
}

// Safely initialize passive Web Vital listeners in browser environments
if (typeof window !== 'undefined' && typeof PerformanceObserver !== 'undefined') {
  initPerfObservers();
}
