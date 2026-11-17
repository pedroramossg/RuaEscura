import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useDebounce } from '../hooks/useDebounce';
import {
  assertSafeFetchUrl,
  clearNetworkCache,
  fetchParallelSettled,
  fetchWithDedupAndTimeout,
} from '../utils/network';
import {
  getPerfSnapshot,
  initPerfObservers,
  recordPerfMetric,
  recordWebVital,
  resetPerfMonitor,
  startPerfSpan,
} from '../utils/perfMonitor';
import { SkeletonBlock, TabSkeleton } from '../components/ui/Skeleton';
import { VirtualizedList } from '../components/ui/VirtualizedList';

describe('Performance Engine, Hardened Network & UI Virtualization', () => {
  beforeEach(() => {
    clearNetworkCache();
    resetPerfMonitor();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('useDebounce', () => {
    it('debounces rapid updates and cancels pending timer on unmount', () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      const { result, rerender, unmount } = renderHook(
        ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
        { initialProps: { value: 'inicial', delay: 200 } }
      );

      expect(result.current).toBe('inicial');

      rerender({ value: 'bu', delay: 200 });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe('inicial');

      rerender({ value: 'biblioteca', delay: 200 });
      act(() => {
        vi.advanceTimersByTime(199);
      });
      expect(result.current).toBe('inicial');

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toBe('biblioteca');

      rerender({ value: 'pendente', delay: 200 });
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current).toBe('biblioteca');
    });
  });

  describe('Hardened Network Engine (fetchWithDedupAndTimeout & fetchParallelSettled)', () => {
    it('deduplicates concurrent identical GET requests and caches within ttlMs', async () => {
      let resolveFetch: ((res: Response) => void) | undefined;
      const fetcher = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      );

      const url = 'https://tile.openstreetmap.org/16/2345/4567.png';
      const p1 = fetchWithDedupAndTimeout<{ ok: boolean }>(url, { fetcher, ttlMs: 1000 });
      const p2 = fetchWithDedupAndTimeout<{ ok: boolean }>(url, { fetcher, ttlMs: 1000 });

      expect(fetcher).toHaveBeenCalledTimes(1);

      resolveFetch?.({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true }),
      } as unknown as Response);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual({ ok: true });
      expect(r2).toEqual({ ok: true });

      // Subsequent call within ttlMs hits local cache without calling fetch
      const r3 = await fetchWithDedupAndTimeout<{ ok: boolean }>(url, { fetcher, ttlMs: 1000 });
      expect(r3).toEqual({ ok: true });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('aborts and times out hanging requests cleanly via AbortController', async () => {
      vi.useFakeTimers();

      let observedSignal: AbortSignal | null | undefined;
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        observedSignal = init?.signal;
        return new Promise<Response>(() => {});
      });

      const pending = fetchWithDedupAndTimeout('https://server.arcgisonline.com/arcgis/rest/services', {
        fetcher,
        timeoutMs: 150,
      });

      const rejectionAssertion = expect(pending).rejects.toThrow(/tempo limite|exceeded|150ms/i);

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      await rejectionAssertion;
      expect(observedSignal?.aborted).toBe(true);
    });

    it('blocks SSRF, non-HTTPS, private IP, and script/data URLs before hitting fetch', async () => {
      const fetcher = vi.fn();
      const blockedUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'https://169.254.169.254/latest/meta-data/',
        'http://127.0.0.1:8080/admin',
        'https://10.0.0.5/internal',
        'http://tile.openstreetmap.org/1/1/1.png',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '//evil.example.com/steal',
        'https://evil.example.com/api',
        'https://tile.openstreetmap.org.evil.com/1/1/1.png',
      ];

      for (const badUrl of blockedUrls) {
        expect(() => assertSafeFetchUrl(badUrl)).toThrow();
        await expect(fetchWithDedupAndTimeout(badUrl, { fetcher })).rejects.toThrow();
      }
      expect(fetcher).not.toHaveBeenCalled();

      expect(assertSafeFetchUrl('https://a.tile.openstreetmap.org/15/1/2.png')).toBe(
        'https://a.tile.openstreetmap.org/15/1/2.png'
      );
      expect(assertSafeFetchUrl('https://server.arcgisonline.com/ArcGIS/rest/services')).toBe(
        'https://server.arcgisonline.com/ArcGIS/rest/services'
      );
      expect(assertSafeFetchUrl('/api/lights.json')).toBe('/api/lights.json');
    });

    it('executes parallel requests via fetchParallelSettled with isolated failure handling', async () => {
      const fetcher = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('fail')) {
          return { ok: false, status: 503, statusText: 'Service Unavailable' } as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ source: url }),
        } as unknown as Response;
      });

      const results = await fetchParallelSettled(
        [
          { key: 'osm', url: 'https://b.tile.openstreetmap.org/tile.json' },
          { key: 'broken', url: '/api/fail' },
          { key: 'ssrf', url: 'http://169.254.169.254/latest/meta-data/' },
        ],
        { fetcher }
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        status: 'fulfilled',
        key: 'osm',
        value: { source: 'https://b.tile.openstreetmap.org/tile.json' },
      });
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('rejected');
    });
  });

  describe('perfMonitor (Zero-PII Slow-Span & Web Vitals Recorder)', () => {
    it('tracks span durations, flags slow operations (> 200ms), strips query PII, and freezes snapshot', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      recordPerfMetric('route:dijkstra?token=secret', 42);
      recordPerfMetric('tile:fetch?user=123', 275);
      recordWebVital('FCP', 180);
      recordWebVital('LCP', 920);
      recordWebVital('CLS', 0.02);
      recordWebVital('INP', 65);

      const span = startPerfSpan('render:markers');
      const duration = span.end();
      expect(duration).toBeGreaterThanOrEqual(0);

      const snapshot = getPerfSnapshot();
      expect(snapshot.totalRecorded).toBe(3);
      expect(snapshot.slowCount).toBe(1);
      expect(snapshot.slowOperations).toHaveLength(1);
      expect(snapshot.slowOperations[0].name).toBe('tile:fetch');
      expect(snapshot.slowOperations[0].durationMs).toBe(275);
      expect(snapshot.metrics['route:dijkstra'].slowCount).toBe(0);
      expect(snapshot.vitals).toEqual({ FCP: 180, LCP: 920, CLS: 0.02, INP: 65 });
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.slowOperations)).toBe(true);
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Gracefully handles observer initialization in JSDOM
      const disconnect = initPerfObservers();
      expect(typeof disconnect).toBe('function');
      disconnect();
    });
  });

  describe('Skeleton & VirtualizedList UI Primitives', () => {
    it('renders accessible TabSkeleton and SkeletonBlock with aria-busy="true" and Cobalt/Cream palette', () => {
      const { container } = render(
        React.createElement(
          'div',
          null,
          React.createElement(TabSkeleton, { label: 'Carregando postes...', rows: 2 }),
          React.createElement(SkeletonBlock, { tone: 'cobalt', width: 80, height: 16 })
        )
      );

      const status = screen.getByRole('status', { name: 'Carregando postes...' });
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(container.innerHTML).toContain('#FEF1CF');
      expect(container.innerHTML).toContain('#0131CD');
    });

    it('paginates items by pageSize with "Carregar mais" and supports windowStart/windowSize slicing', () => {
      const items = Array.from({ length: 12 }, (_, idx) => ({
        id: `item-${idx + 1}`,
        label: `Poste ${idx + 1}`,
      }));

      const { rerender } = render(
        React.createElement(VirtualizedList<{ id: string; label: string }>, {
          items,
          pageSize: 5,
          getItemKey: (item) => item.id,
          ariaLabel: 'Lista de postes',
          renderItem: (item) => React.createElement('span', null, item.label),
        })
      );

      const listEl = screen.getByRole('list', { name: 'Lista de postes' });
      expect(listEl).toHaveAttribute('data-slice-start', '0');
      expect(listEl).toHaveAttribute('data-slice-end', '5');
      expect(screen.getByText('Poste 1')).toBeInTheDocument();
      expect(screen.getByText('Poste 5')).toBeInTheDocument();
      expect(screen.queryByText('Poste 6')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Carregar mais \(7\)/i }));
      expect(screen.getByText('Poste 10')).toBeInTheDocument();
      expect(screen.queryByText('Poste 11')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Carregar mais \(2\)/i }));
      expect(screen.getByText('Poste 12')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Carregar mais/i })).not.toBeInTheDocument();

      // Deterministic range slicing mode (windowStart=3, windowSize=4 => items 4..7)
      rerender(
        React.createElement(VirtualizedList<{ id: string; label: string }>, {
          items,
          windowStart: 3,
          windowSize: 4,
          getItemKey: (item) => item.id,
          ariaLabel: 'Lista fatiada',
          renderItem: (item) => React.createElement('span', null, item.label),
        })
      );

      const slicedList = screen.getByRole('list', { name: 'Lista fatiada' });
      expect(slicedList).toHaveAttribute('data-slice-start', '3');
      expect(slicedList).toHaveAttribute('data-slice-end', '7');
      expect(screen.queryByText('Poste 3')).not.toBeInTheDocument();
      expect(screen.getByText('Poste 4')).toBeInTheDocument();
      expect(screen.getByText('Poste 7')).toBeInTheDocument();
      expect(screen.queryByText('Poste 8')).not.toBeInTheDocument();

      // Empty state rendering
      rerender(
        React.createElement(VirtualizedList<{ id: string; label: string }>, {
          items: [],
          emptyState: React.createElement('p', null, 'Nenhum item encontrado'),
          renderItem: (item) => React.createElement('span', null, item.label),
        })
      );
      expect(screen.getByText('Nenhum item encontrado')).toBeInTheDocument();
    });
  });
});
