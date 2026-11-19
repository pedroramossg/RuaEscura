import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { FloatingTabBar } from '../components/ui/FloatingTabBar';
import { BottomSheet, SheetDetent } from '../components/ui/BottomSheet';
import { PillButton } from '../components/ui/PillButton';
import { LiquidGlassSurface } from '../components/ui/LiquidGlassSurface';
import { useHaptics } from '../hooks/useHaptics';

describe('FloatingTabBar UI Primitive', () => {
  it('renders exactly 4 tab buttons with required labels and minimum 44px hit targets', () => {
    const handleTabChange = vi.fn();
    render(
      <FloatingTabBar
        activeTab="mapa"
        onTabChange={handleTabChange}
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    const labels = tabs.map((tab) => tab.textContent?.trim());
    expect(labels).toEqual(
      expect.arrayContaining(['Explorar', 'Mapa', 'Postes', 'Denúncias'])
    );

    // Assert minimum 44px touch target styling
    tabs.forEach((tab) => {
      expect(tab.className).toMatch(/(min-h-\[44px\]|h-11|h-12|min-h-11|min-h-12)/);
      expect(tab.className).toMatch(/(min-w-\[44px\]|w-11|w-12|min-w-11|min-w-12)/);
    });

    // Active tab must have aria-current="page"
    const activeTab = screen.getByRole('tab', { name: /mapa/i });
    expect(activeTab).toHaveAttribute('aria-current', 'page');

    const inactiveTab = screen.getByRole('tab', { name: /explorar/i });
    expect(inactiveTab).not.toHaveAttribute('aria-current', 'page');

    // Clicking inactive tab calls onTabChange
    fireEvent.click(inactiveTab);
    expect(handleTabChange).toHaveBeenCalledWith('explorar');
  });

  it('renders alert count badge when alertCount is provided and positive', () => {
    render(
      <FloatingTabBar
        activeTab="explorar"
        onTabChange={vi.fn()}
        alertCount={3}
      />
    );

    const badge = screen.getByText('3');
    expect(badge).toBeInTheDocument();
  });

  it('minimizes on scroll down past 80px and restores on scroll up while preserving tab roles and accessible names', () => {
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });

    const { rerender } = render(
      <FloatingTabBar
        activeTab="explorar"
        onTabChange={vi.fn()}
      />
    );

    const nav = screen.getByRole('navigation', { name: /navegação principal/i });
    expect(nav).toHaveAttribute('data-minimized', 'false');

    // Scroll down past 80px -> minimizes
    window.scrollY = 140;
    fireEvent.scroll(window);
    expect(nav).toHaveAttribute('data-minimized', 'true');

    // All 4 tabs and their accessible names remain intact while minimized
    const minimizedTabs = screen.getAllByRole('tab');
    expect(minimizedTabs).toHaveLength(4);
    expect(screen.getByRole('tab', { name: /explorar/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /mapa/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /postes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /denúncias/i })).toBeInTheDocument();

    // Small jitter (< 12px) does not restore minimized state
    window.scrollY = 134;
    fireEvent.scroll(window);
    expect(nav).toHaveAttribute('data-minimized', 'true');

    // Scroll up (>= 12px) -> restores expanded state
    window.scrollY = 100;
    fireEvent.scroll(window);
    expect(nav).toHaveAttribute('data-minimized', 'false');

    // Scroll down again, then change activeTab -> restores expanded state
    window.scrollY = 180;
    fireEvent.scroll(window);
    expect(nav).toHaveAttribute('data-minimized', 'true');

    rerender(
      <FloatingTabBar
        activeTab="mapa"
        onTabChange={vi.fn()}
      />
    );
    expect(nav).toHaveAttribute('data-minimized', 'false');

    // Reset scrollY cleanly
    window.scrollY = 0;
  });
});

describe('BottomSheet UI Primitive', () => {
  function ControlledSheet() {
    const [detent, setDetent] = useState<SheetDetent>('peek');
    return (
      <BottomSheet
        detent={detent}
        onDetentChange={setDetent}
        grabberLabel="Controlar painel"
      >
        <p>Conteúdo do Sheet</p>
      </BottomSheet>
    );
  }

  it('exposes a clickable grabber cycling detents in controlled mode (peek -> medium -> expanded -> peek)', () => {
    render(<ControlledSheet />);

    expect(screen.getByText('Conteúdo do Sheet')).toBeInTheDocument();

    const grabber = screen.getByRole('button', { name: /controlar painel/i });
    expect(grabber).toBeInTheDocument();

    // Initial state is peek
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'peek');

    // First click: peek -> medium
    fireEvent.click(grabber);
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'medium');

    // Second click: medium -> expanded
    fireEvent.click(grabber);
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'expanded');

    // Third click: cycles back to peek
    fireEvent.click(grabber);
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'peek');
  });

  it('supports uncontrolled mode with internal detent state fallback', () => {
    render(
      <BottomSheet grabberLabel="Grabber Uncontrolled">
        <p>Conteúdo Uncontrolled</p>
      </BottomSheet>
    );

    const grabber = screen.getByRole('button', { name: /grabber uncontrolled/i });
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'peek');

    fireEvent.click(grabber);
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'medium');

    fireEvent.click(grabber);
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'expanded');

    fireEvent.click(grabber);
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute('data-detent', 'peek');
  });

  it('calls onDetentChange directly when grabber is tapped in controlled mode', () => {
    const handleDetentChange = vi.fn();
    render(
      <BottomSheet
        detent="peek"
        onDetentChange={handleDetentChange}
        grabberLabel="Grabber"
      >
        <div>Sheet Child</div>
      </BottomSheet>
    );

    const grabber = screen.getByRole('button', { name: /grabber/i });
    fireEvent.click(grabber);
    expect(handleDetentChange).toHaveBeenCalledWith('medium');
  });
});

describe('PillButton UI Primitive', () => {
  it('renders with 9999px pill radius, minimum 44px hit target, and fires onClick', () => {
    const handleClick = vi.fn();
    render(
      <PillButton variant="lime" size="compact" onClick={handleClick}>
        Começar meu trajeto
      </PillButton>
    );

    const button = screen.getByRole('button', { name: /começar meu trajeto/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('rounded-full');
    expect(button.className).toMatch(/(min-h-\[44px\]|h-12)/);

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports feature size and ink/glass/danger/outline variants', () => {
    const { rerender } = render(
      <PillButton variant="ink" size="feature">
        Ação Principal
      </PillButton>
    );
    let button = screen.getByRole('button', { name: /ação principal/i });
    expect(button.className).toMatch(/(h-20|min-h-\[44px\])/);

    rerender(<PillButton variant="glass">Glass Action</PillButton>);
    button = screen.getByRole('button', { name: /glass action/i });
    expect(button.className).toContain('liquid-glass');

    rerender(<PillButton variant="danger">Emergência</PillButton>);
    button = screen.getByRole('button', { name: /emergência/i });
    expect(button.className).toContain('bg-[#D70015]');
  });
});

describe('LiquidGlassSurface UI Primitive', () => {
  it('defaults to control variant and applies liquid-glass or liquid-glass-dark based on dark prop', () => {
    const { container, rerender } = render(
      <LiquidGlassSurface dark={false}>
        <span>Floating Bar</span>
      </LiquidGlassSurface>
    );

    const surface = container.firstChild as HTMLElement;
    expect(surface.className).toContain('liquid-glass');
    expect(surface.className).toContain('rounded-2xl');
    expect(surface.className).not.toContain('liquid-glass-dark');

    rerender(
      <LiquidGlassSurface dark={true}>
        <span>Floating Bar</span>
      </LiquidGlassSurface>
    );
    expect(surface.className).toContain('liquid-glass-dark');
  });
});

describe('useHaptics Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: vi.fn(),
    });
    localStorage.clear();
  });

  function HapticTestComponent() {
    const { enabled, setEnabled, trigger } = useHaptics();
    return (
      <div>
        <span data-testid="enabled-state">{enabled ? 'enabled' : 'disabled'}</span>
        <button onClick={() => trigger('selection')}>Trigger Selection</button>
        <button onClick={() => trigger('success')}>Trigger Success</button>
        <button onClick={() => setEnabled(false)}>Disable</button>
      </div>
    );
  }

  it('triggers navigator.vibrate when enabled and skips when disabled', () => {
    render(<HapticTestComponent />);

    expect(screen.getByTestId('enabled-state').textContent).toBe('enabled');

    fireEvent.click(screen.getByRole('button', { name: /trigger selection/i }));
    expect(navigator.vibrate).toHaveBeenCalledWith(12);

    fireEvent.click(screen.getByRole('button', { name: /trigger success/i }));
    expect(navigator.vibrate).toHaveBeenCalledWith([15, 60, 20]);

    // Disable haptics
    fireEvent.click(screen.getByRole('button', { name: /disable/i }));
    expect(screen.getByTestId('enabled-state').textContent).toBe('disabled');

    (navigator.vibrate as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByRole('button', { name: /trigger selection/i }));
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });
});
