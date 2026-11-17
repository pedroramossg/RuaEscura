import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DropletMascot, DROPLET_ALL_STATES } from '../components/mascot/DropletMascot';
import { BotEngine } from '../mascot/bloub/engine';
import { EXPRESSION_BY_ID } from '../mascot/bloub/expressions';
import { RAYON } from '../mascot/bloub/repere';
import { SHAPE_BY_ID } from '../mascot/bloub/skins';
import { POSES, type StateId } from '../mascot/bloub/states';

const EXPECTED_STATES: StateId[] = [
  'idle',
  'thinking',
  'wink',
  'wide',
  'alert',
  'notify',
  'exclaim',
  'sleep',
  'egg',
  'hexagon',
  'play',
  'orbit',
  'swirl',
  'burst',
  'comet',
];

describe('DropletMascot', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('exports all 15 bloub states in DROPLET_ALL_STATES', () => {
    expect(DROPLET_ALL_STATES).toHaveLength(15);
    expect(DROPLET_ALL_STATES).toEqual(EXPECTED_STATES);
  });

  it('defaults to droplet shape ("goutte") and "heureux" expression with hole-masked eyes and RuaEscura palette', () => {
    render(<DropletMascot frozenAt={POSES.idle} />);

    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '-158 -158 316 316');
    expect(svg).toHaveAttribute('width', '88');
    expect(svg).toHaveAttribute('height', '88');
    expect(svg).toHaveAttribute('data-shape', 'goutte');
    expect(svg).toHaveAttribute('data-expression', 'heureux');

    // Verify rendered bodyPath matches goutte + heureux engine snapshot (and differs from cercle)
    const goutteRadii = SHAPE_BY_ID.get('goutte')!.radii;
    const cercleRadii = SHAPE_BY_ID.get('cercle')!.radii;
    const heureuxExpr = EXPRESSION_BY_ID.get('heureux')!;
    const expectedFrame = new BotEngine(RAYON, 'idle', goutteRadii, heureuxExpr).sample(POSES.idle);
    const circleFrame = new BotEngine(RAYON, 'idle', cercleRadii, heureuxExpr).sample(POSES.idle);

    expect(expectedFrame.bodyPath).not.toBe(circleFrame.bodyPath);

    const mask = svg.querySelector('mask');
    expect(mask).not.toBeNull();
    const maskPaths = mask!.querySelectorAll('path');
    // 1 white body cutout base + 2 black hole-masked eyes
    expect(maskPaths.length).toBe(3);
    expect(maskPaths[0]).toHaveAttribute('fill', '#fff');
    expect(maskPaths[0]).toHaveAttribute('d', expectedFrame.bodyPath);
    expect(maskPaths[1]).toHaveAttribute('fill', '#000');
    expect(maskPaths[2]).toHaveAttribute('fill', '#000');

    // Backing path in paperColor (#FEF1CF) and masked rect in inkColor (#0131CD)
    const backingPath = svg.querySelector(`path[fill="#FEF1CF"]`);
    expect(backingPath).not.toBeNull();
    expect(backingPath).toHaveAttribute('d', expectedFrame.bodyPath);

    const maskedGroup = svg.querySelector(`g[mask="url(#${mask!.id})"]`);
    expect(maskedGroup).not.toBeNull();
    const inkRect = maskedGroup!.querySelector('rect');
    expect(inkRect).toHaveAttribute('fill', '#0131CD');
  });

  it('supports custom RuaEscura palette overrides including inkColor, paperColor, and notifColor', () => {
    render(
      <DropletMascot
        state="notify"
        size={120}
        inkColor="#0131CD"
        paperColor="#FEF1CF"
        notifColor="#B9FC01"
        frozenAt={POSES.notify}
        ariaLabel="Alerta de iluminação"
      />
    );

    const svg = screen.getByRole('img', { name: 'Alerta de iluminação' });
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '120');
    expect(svg.querySelector('path[fill="#FEF1CF"]')).not.toBeNull();
    expect(svg.querySelector('rect[fill="#0131CD"]')).not.toBeNull();
    // Notification badge + mask notch
    expect(svg.querySelector('circle[fill="#B9FC01"]')).not.toBeNull();
    expect(svg.querySelector('mask circle[fill="#000"]')).not.toBeNull();
  });

  it('renders all 15 DROPLET_ALL_STATES deterministically without runtime errors or NaN geometry', () => {
    const { container, rerender } = render(<DropletMascot state="idle" frozenAt={POSES.idle} />);

    for (const state of DROPLET_ALL_STATES) {
      rerender(<DropletMascot state={state} frozenAt={POSES[state]} />);

      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('data-state', state);

      const serialized = container.innerHTML;
      expect(serialized).not.toContain('NaN');
      expect(serialized).not.toContain('undefined');

      const expected = new BotEngine(
        RAYON,
        state,
        SHAPE_BY_ID.get('goutte')!.radii,
        EXPRESSION_BY_ID.get('heureux')!
      ).sample(POSES[state]);

      const backingPath = svg.querySelector('path[fill="#FEF1CF"]');
      expect(backingPath).toHaveAttribute('d', expected.bodyPath);
    }

    // Spot-check special state decor elements:
    // alert: teardrop dot path
    rerender(<DropletMascot state="alert" frozenAt={POSES.alert} />);
    const alertSvg = screen.getByRole('img');
    expect(alertSvg.querySelector('path[transform*="rotate("]')).not.toBeNull();

    // orbit: linearGradient + front/back arcs
    rerender(<DropletMascot state="orbit" frozenAt={POSES.orbit} />);
    const orbitSvg = screen.getByRole('img');
    expect(orbitSvg.querySelectorAll('linearGradient').length).toBeGreaterThan(0);

    // burst: depth-mixed particles rendered behind body
    rerender(<DropletMascot state="burst" frozenAt={POSES.burst} />);
    const burstSvg = screen.getByRole('img');
    expect(burstSvg.querySelectorAll('circle').length).toBeGreaterThan(0);
  });

  it('respects prefers-reduced-motion by rendering deterministically at POSES[state] without an active RAF loop', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    render(<DropletMascot state="orbit" />);

    expect(rafSpy).not.toHaveBeenCalled();

    const expected = new BotEngine(
      RAYON,
      'orbit',
      SHAPE_BY_ID.get('goutte')!.radii,
      EXPRESSION_BY_ID.get('heureux')!
    ).sample(POSES.orbit);

    const svg = screen.getByRole('img');
    const backingPath = svg.querySelector('path[fill="#FEF1CF"]');
    expect(backingPath).toHaveAttribute('d', expected.bodyPath);
  });

  it('morphs cleanly in live RAF mode when state prop changes dynamically and cancels RAF on unmount', () => {
    let nextId = 1;
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id);
    });

    const flushFrame = (timestamp: number) => {
      const pending = Array.from(rafCallbacks.entries());
      rafCallbacks.clear();
      for (const [, cb] of pending) {
        cb(timestamp);
      }
    };

    const { rerender, unmount } = render(<DropletMascot state="idle" />);
    expect(rafSpy).toHaveBeenCalled();

    act(() => {
      flushFrame(100);
      flushFrame(200);
    });

    const idlePath = screen.getByRole('img').querySelector('path[fill="#FEF1CF"]')?.getAttribute('d');

    rerender(<DropletMascot state="alert" />);

    act(() => {
      // Sample mid-morph after state change
      flushFrame(300);
    });

    const midMorphPath = screen
      .getByRole('img')
      .querySelector('path[fill="#FEF1CF"]')
      ?.getAttribute('d');
    expect(midMorphPath).toBeTruthy();
    expect(midMorphPath).not.toBe(idlePath);

    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('handles interactive click/tap cycling with accessible >=44px button semantics and wrap-around', () => {
    const handleCycle = vi.fn();
    const handleTap = vi.fn();

    const { rerender } = render(
      <DropletMascot
        interactive
        onStateCycle={handleCycle}
        onTap={handleTap}
        frozenAt={POSES.idle}
        ariaLabel="Mascote interativo"
      />
    );

    const button = screen.getByRole('button', { name: 'Mascote interativo' });
    expect(button.className).toContain('min-w-[44px]');
    expect(button.className).toContain('min-h-[44px]');
    expect(screen.getByRole('img', { name: 'Mascote interativo' })).toBeInTheDocument();

    // Uncontrolled: idle -> thinking -> wink
    fireEvent.click(button);
    expect(handleCycle).toHaveBeenNthCalledWith(1, 'thinking');
    expect(handleTap).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    expect(handleCycle).toHaveBeenNthCalledWith(2, 'wink');
    expect(handleTap).toHaveBeenCalledTimes(2);

    // Controlled wrap-around: comet -> idle
    handleCycle.mockClear();
    rerender(
      <DropletMascot
        state="comet"
        interactive
        onStateCycle={handleCycle}
        frozenAt={POSES.comet}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleCycle).toHaveBeenCalledWith('idle');
  });

  it('tracks non-touch pointer gaze in live RAF mode and ignores touch pointers', () => {
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id);
    });

    const flushFrame = (timestamp: number) => {
      const pending = Array.from(rafCallbacks.entries());
      rafCallbacks.clear();
      for (const [, cb] of pending) cb(timestamp);
    };

    const dispatchPointerMove = (clientX: number, clientY: number, pointerType: string) => {
      const ev = new MouseEvent('pointermove', { clientX, clientY, bubbles: true });
      Object.defineProperty(ev, 'pointerType', { value: pointerType });
      window.dispatchEvent(ev);
    };

    const { unmount } = render(
      <>
        <DropletMascot state="idle" follow ariaLabel="Com follow" />
        <DropletMascot state="idle" follow={false} ariaLabel="Sem follow" />
      </>
    );
    const followSvg = screen.getByRole('img', { name: 'Com follow' });
    const staticFollowSvg = screen.getByRole('img', { name: 'Sem follow' });

    const rect = {
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      width: 88,
      height: 88,
      right: 188,
      bottom: 188,
      toJSON: () => ({}),
    };
    vi.spyOn(followSvg, 'getBoundingClientRect').mockReturnValue(rect);
    vi.spyOn(staticFollowSvg, 'getBoundingClientRect').mockReturnValue(rect);

    act(() => {
      flushFrame(100);
      flushFrame(150);
    });

    // Touch pointermove must be ignored — both mascots remain identical
    act(() => {
      dispatchPointerMove(-500, 500, 'touch');
      flushFrame(210);
      flushFrame(270);
    });
    const followAfterTouch = followSvg
      .querySelector('mask path[fill="#000"]')
      ?.getAttribute('transform');
    const noFollowAfterTouch = staticFollowSvg
      .querySelector('mask path[fill="#000"]')
      ?.getAttribute('transform');
    expect(followAfterTouch).toBe(noFollowAfterTouch);

    // Mouse pointermove far left steers gaze on follow=true, leaving follow=false untouched
    act(() => {
      dispatchPointerMove(-500, 500, 'mouse');
      flushFrame(330);
      flushFrame(390);
      flushFrame(450);
    });
    const followSteered = followSvg
      .querySelector('mask path[fill="#000"]')
      ?.getAttribute('transform');
    const noFollowUnchanged = staticFollowSvg
      .querySelector('mask path[fill="#000"]')
      ?.getAttribute('transform');
    expect(followSteered).toBeTruthy();
    expect(followSteered).not.toBe(noFollowUnchanged);

    // Pointer leave releases gaze cleanly without errors
    act(() => {
      document.dispatchEvent(new Event('pointerleave'));
      flushFrame(510);
    });

    unmount();
  });
});
