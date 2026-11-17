import { startPerfSpan } from './perfMonitor';

const ALLOWED_HTTPS_HOSTNAMES = new Set([
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'server.arcgisonline.com',
]);

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_CACHE_ENTRIES = 100;

export type SafeResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer';

export interface SafeFetchOptions<T = unknown> {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE';
  headers?: HeadersInit;
  body?: BodyInit | null;
  timeoutMs?: number;
  ttlMs?: number;
  bypassCache?: boolean;
  signal?: AbortSignal;
  responseType?: SafeResponseType;
  parse?: (response: Response) => Promise<T>;
  fetcher?: typeof fetch;
}

export interface ParallelFetchTask<T = unknown> {
  key?: string;
  url: string;
  options?: SafeFetchOptions<T>;
}

export type ParallelFetchResult<T = unknown> =
  | { status: 'fulfilled'; key: string; url: string; value: T }
  | { status: 'rejected'; key: string; url: string; reason: Error };

interface CachedResponseEntry {
  value: unknown;
  expiresAt: number;
}

const inFlightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, CachedResponseEntry>();

function isControlOrBackslashPresent(rawUrl: string): boolean {
  for (let i = 0; i < rawUrl.length; i++) {
    const code = rawUrl.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) {
      return true;
    }
  }
  return false;
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower === '::1') {
    return true;
  }
  // Reject IPv4 loopback, link-local (169.254.0.0/16 metadata), RFC1918, and CGNAT
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lower)) {
    const octets = lower.split('.').map((n) => Number(n));
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/**
 * Validates URL against Zero-Trust allowlist:
 * - Same-origin relative path starting with `/` (never `//` or `/\`)
 * - `https://` URL matching exact allowed hostnames (`tile.openstreetmap.org`, `a/b/c.tile.openstreetmap.org`, `server.arcgisonline.com`)
 * Rejects HTTP, private/metadata IPs, embedded credentials, `javascript:`, `data:`, `blob:`, `file:`.
 */
export function assertSafeFetchUrl(rawUrl: string): string {
  if (typeof rawUrl !== 'string') {
    throw new Error('URL inválida: esperado texto não vazio.');
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || isControlOrBackslashPresent(trimmed)) {
    throw new Error('URL bloqueada pela política Zero-Trust (vazia ou caracteres proibidos).');
  }

  if (trimmed.startsWith('/')) {
    // Reject protocol-relative URLs (`//evil.com`) and userinfo tricks
    if (trimmed.startsWith('//')) {
      throw new Error('URL protocol-relative bloqueada pela política Zero-Trust.');
    }
    let parsedRelative: URL;
    try {
      parsedRelative = new URL(trimmed, 'https://same-origin.local');
    } catch {
      throw new Error('Caminho relativo malformado.');
    }
    if (
      parsedRelative.hostname !== 'same-origin.local' ||
      !parsedRelative.pathname.startsWith('/') ||
      parsedRelative.username ||
      parsedRelative.password
    ) {
      throw new Error('Caminho relativo bloqueado pela política Zero-Trust.');
    }
    return `${parsedRelative.pathname}${parsedRelative.search}${parsedRelative.hash}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('URL malformada bloqueada pela política Zero-Trust.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Protocolo não permitido (${parsed.protocol}): apenas HTTPS ou mesma origem.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error('Credenciais embutidas na URL são proibidas.');
  }

  if (parsed.port && parsed.port !== '443') {
    throw new Error(`Porta não permitida (${parsed.port}): apenas HTTPS padrão (443).`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isPrivateOrLoopbackHost(hostname)) {
    throw new Error(`Host privado/loopback bloqueado (${hostname}).`);
  }

  if (!ALLOWED_HTTPS_HOSTNAMES.has(hostname)) {
    throw new Error(`Host não autorizado pela allowlist Zero-Trust: ${hostname}`);
  }

  return parsed.toString();
}

export function isAllowedFetchUrl(rawUrl: string): boolean {
  try {
    assertSafeFetchUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}

function buildTelemetryTarget(safeUrl: string): string {
  if (safeUrl.startsWith('/')) {
    return safeUrl.split('?')[0].split('#')[0];
  }
  const parsed = new URL(safeUrl);
  return `${parsed.hostname}${parsed.pathname}`;
}

function createAbortError(message = 'Requisição cancelada.'): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

function setCachedResponse(cacheKey: string, value: unknown, ttlMs: number): void {
  if (ttlMs <= 0) return;
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) {
      responseCache.delete(oldestKey);
    }
  }
  responseCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function waitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

async function parseResponse<T>(
  response: Response,
  responseType: SafeResponseType,
  customParse?: (response: Response) => Promise<T>
): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText || 'Error'}`.trim());
  }
  if (customParse) {
    return customParse(response);
  }
  switch (responseType) {
    case 'text':
      return (await response.text()) as unknown as T;
    case 'blob':
      return (await response.blob()) as unknown as T;
    case 'arrayBuffer':
      return (await response.arrayBuffer()) as unknown as T;
    case 'json':
    default:
      return (await response.json()) as T;
  }
}

/**
 * Hardened fetch engine with:
 * - Strict Zero-Trust URL allowlist validation
 * - In-flight concurrent GET deduplication
 * - Optional short-lived response cache (`ttlMs`)
 * - AbortController timeout enforcement (default 5000ms)
 * - Zero-PII perfMonitor span recording
 */
export async function fetchWithDedupAndTimeout<T = unknown>(
  url: string,
  options: SafeFetchOptions<T> = {}
): Promise<T> {
  const safeUrl = assertSafeFetchUrl(url);
  const method = (options.method ?? 'GET').toUpperCase() as NonNullable<SafeFetchOptions<T>['method']>;
  const timeoutMs =
    typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const ttlMs =
    typeof options.ttlMs === 'number' && Number.isFinite(options.ttlMs) && options.ttlMs > 0
      ? options.ttlMs
      : 0;
  const responseType = options.responseType ?? 'json';
  const cacheKey = `${method}:${safeUrl}:${responseType}`;
  const telemetryLabel = `net:${method}:${buildTelemetryTarget(safeUrl)}`;

  if (options.signal?.aborted) {
    throw createAbortError();
  }

  const isCacheableGet = method === 'GET' && !options.bypassCache;

  if (isCacheableGet && ttlMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const cacheSpan = startPerfSpan(`${telemetryLabel}:cache`);
      cacheSpan.end();
      return cached.value as T;
    }
    if (cached) {
      responseCache.delete(cacheKey);
    }
  }

  if (isCacheableGet) {
    const existingFlight = inFlightRequests.get(cacheKey);
    if (existingFlight) {
      return waitWithSignal(existingFlight as Promise<T>, options.signal);
    }
  }

  const fetchImpl = options.fetcher ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API indisponível neste ambiente.');
  }

  const runRequest = async (): Promise<T> => {
    const span = startPerfSpan(telemetryLabel);
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let onExternalAbort: (() => void) | undefined;

    if (options.signal && !isCacheableGet) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        onExternalAbort = () => controller.abort();
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = globalThis.setTimeout(() => {
        const timeoutErr = new Error(`Tempo limite de ${timeoutMs}ms excedido para ${buildTelemetryTarget(safeUrl)}`);
        timeoutErr.name = 'TimeoutError';
        controller.abort();
        reject(timeoutErr);
      }, timeoutMs);
    });

    const fetchPromise = (async () => {
      const response = await fetchImpl(safeUrl, {
        method,
        headers: options.headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : options.body,
        redirect: 'error',
        signal: controller.signal,
      });
      return parseResponse<T>(response, responseType, options.parse);
    })();

    // Prevent unhandled rejection warning if timeoutPromise rejects first
    fetchPromise.catch(() => {});

    try {
      const data = await Promise.race([fetchPromise, timeoutPromise]);
      if (isCacheableGet && ttlMs > 0) {
        setCachedResponse(cacheKey, data, ttlMs);
      }
      return data;
    } finally {
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId);
      }
      if (options.signal && onExternalAbort) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
      span.end();
    }
  };

  if (!isCacheableGet) {
    return runRequest();
  }

  const sharedPromise = runRequest().finally(() => {
    if (inFlightRequests.get(cacheKey) === sharedPromise) {
      inFlightRequests.delete(cacheKey);
    }
  });

  inFlightRequests.set(cacheKey, sharedPromise);
  return waitWithSignal(sharedPromise, options.signal);
}

/**
 * Executes multiple independent requests concurrently with isolated error resilience.
 */
export async function fetchParallelSettled<T = unknown>(
  requests: ReadonlyArray<string | ParallelFetchTask<T>>,
  sharedOptions: SafeFetchOptions<T> = {}
): Promise<Array<ParallelFetchResult<T>>> {
  const span = startPerfSpan('net:parallel');
  try {
    const normalizedTasks = requests.map((item, idx) => {
      if (typeof item === 'string') {
        return { key: String(idx), url: item, options: sharedOptions };
      }
      return {
        key: item.key ?? String(idx),
        url: item.url,
        options: { ...sharedOptions, ...item.options },
      };
    });

    const settled = await Promise.allSettled(
      normalizedTasks.map((task) => fetchWithDedupAndTimeout<T>(task.url, task.options))
    );

    return settled.map((result, idx) => {
      const task = normalizedTasks[idx];
      if (result.status === 'fulfilled') {
        return {
          status: 'fulfilled',
          key: task.key,
          url: task.url,
          value: result.value,
        };
      }
      return {
        status: 'rejected',
        key: task.key,
        url: task.url,
        reason:
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason ?? 'Erro desconhecido')),
      };
    });
  } finally {
    span.end();
  }
}

/**
 * Clears in-memory response cache and in-flight registry (for test isolation).
 */
export function clearNetworkCache(): void {
  responseCache.clear();
  inFlightRequests.clear();
}
