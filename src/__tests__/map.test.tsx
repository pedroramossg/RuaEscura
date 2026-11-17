import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CampusStoreProvider } from '../hooks/useCampusStore';
import { MapTab } from '../components/map/MapTab';
import { getSeedCampusState } from '../data/ufscTrindade';
import { CAMPUS_STORAGE_KEY } from '../security/storage';

describe('Task 4: Interactive UFSC Map, Route Comparison, Companions & In-Sheet Chat', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function renderMapTab(onOpenReportsShortcut = vi.fn(), customState = getSeedCampusState()) {
    return {
      onOpenReportsShortcut,
      ...render(
        <CampusStoreProvider initialState={customState}>
          <MapTab onOpenReportsShortcut={onOpenReportsShortcut} />
        </CampusStoreProvider>
      ),
    };
  }

  it('renders UFSC campus vector fallback, landmarks, lamp post status markers, and allows selecting a post', () => {
    const seed = getSeedCampusState();
    seed.posts[0] = { ...seed.posts[0], status: 'queimado' };
    seed.posts[1] = { ...seed.posts[1], status: 'oscilando' };

    renderMapTab(vi.fn(), seed);

    expect(screen.getByTestId('campus-map')).toBeInTheDocument();
    expect(screen.getByTestId('campus-vector-fallback')).toBeInTheDocument();

    // Landmarks are accessible and clickable
    const ccePin = screen.getByRole('button', { name: /^CCE —/i });
    expect(ccePin).toBeInTheDocument();

    // Lamp posts expose accessible status (never color-only)
    const burnedPostPin = screen.getByRole('button', {
      name: /POSTE-BU-01.*Queimado/i,
    });
    const oscillatingPostPin = screen.getByRole('button', {
      name: /POSTE-RU-03.*Oscilando/i,
    });
    const litPostPin = screen.getByRole('button', {
      name: /POSTE-CCE-02.*Aceso/i,
    });

    expect(burnedPostPin).toBeInTheDocument();
    expect(oscillatingPostPin).toBeInTheDocument();
    expect(litPostPin).toBeInTheDocument();

    // Clicking a lamp post displays compact status summary and can be closed
    fireEvent.click(burnedPostPin);
    expect(screen.getByRole('status')).toHaveTextContent(/Poste BU Entrada Oeste/i);
    expect(screen.getByRole('status')).toHaveTextContent(/Queimado/i);
    fireEvent.click(screen.getByRole('button', { name: /Fechar resumo do poste/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Clicking a campus node sets destination
    const destSelect = screen.getByLabelText(/^Destino$/i) as HTMLSelectElement;
    expect(destSelect.value).toBe('ru');
    fireEvent.click(ccePin);
    expect(destSelect.value).toBe('cce');
  });

  it('swaps Origin and Destination endpoints and recalculates the route', () => {
    renderMapTab();

    const originSelect = screen.getByLabelText(/^Origem$/i) as HTMLSelectElement;
    const destSelect = screen.getByLabelText(/^Destino$/i) as HTMLSelectElement;

    expect(originSelect.value).toBe('bu');
    expect(destSelect.value).toBe('ru');

    // Change destination to CCE first so route metrics reflect BU <-> CCE vs swapped
    fireEvent.change(destSelect, { target: { value: 'santos_dumont' } });
    expect(originSelect.value).toBe('bu');
    expect(destSelect.value).toBe('santos_dumont');

    const swapButton = screen.getByRole('button', { name: /Trocar origem e destino/i });
    expect(swapButton.className).toMatch(/min-h-\[44px\]/);
    expect(swapButton.className).toMatch(/min-w-\[44px\]/);

    fireEvent.click(swapButton);

    expect(originSelect.value).toBe('santos_dumont');
    expect(destSelect.value).toBe('bu');

    const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
    expect(stored.activeOriginId).toBe('santos_dumont');
    expect(stored.activeDestinationId).toBe('bu');
  });

  it('toggles "☾ Luz Noturna" night state on map and sheet and invokes emergency shortcut', () => {
    const onOpenReports = vi.fn();
    renderMapTab(onOpenReports);

    const mapEl = screen.getByTestId('campus-map');
    const sheetEl = screen.getByTestId('bottom-sheet');
    const nightToggle = screen.getByRole('button', { name: /Luz Noturna/i });

    expect(mapEl).toHaveAttribute('data-night', 'false');
    expect(nightToggle).toHaveAttribute('aria-pressed', 'false');
    expect(sheetEl.className).toContain('bg-white');

    fireEvent.click(nightToggle);

    expect(mapEl).toHaveAttribute('data-night', 'true');
    const dayToggle = screen.getByRole('button', { name: /Mapa Claro/i });
    expect(dayToggle).toHaveAttribute('aria-pressed', 'true');
    expect(sheetEl.className).toContain('bg-[#0B1120]');

    // Satellite / Streets toggle works
    const satToggle = screen.getByRole('button', { name: /Satélite/i });
    expect(satToggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(satToggle);
    const streetsToggle = screen.getByRole('button', { name: /Ruas/i });
    expect(streetsToggle).toHaveAttribute('aria-pressed', 'true');

    // Emergency shortcut triggers callback
    const emergencyBtn = screen.getByRole('button', { name: /emergência|denúncias/i });
    fireEvent.click(emergencyBtn);
    expect(onOpenReports).toHaveBeenCalledTimes(1);
  });

  it('compares "Mais Iluminada" vs "Mais Rápida" routes and toggles map filter chips', () => {
    renderMapTab();

    const sheet = screen.getByTestId('bottom-sheet');
    const brightestBtn = within(sheet).getByRole('button', { name: /Mais Iluminada/i });
    const fastestBtn = within(sheet).getByRole('button', { name: /Mais Rápida/i });

    expect(brightestBtn).toHaveAttribute('aria-pressed', 'true');
    expect(fastestBtn).toHaveAttribute('aria-pressed', 'false');

    // BU -> RU fastest uses real OSM shortcut (360m, low illumination -> dark warning)
    expect(within(sheet).getByText(/360\s*m/i)).toBeInTheDocument();

    fireEvent.click(fastestBtn);
    expect(fastestBtn).toHaveAttribute('aria-pressed', 'true');
    expect(brightestBtn).toHaveAttribute('aria-pressed', 'false');
    expect(within(sheet).getByRole('note')).toHaveTextContent(/Trecho escuro ou poste queimado/i);

    // Filter chip toggles lamp posts visibility
    const postsChip = screen.getByRole('button', { name: /Postes/i });
    expect(postsChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /POSTE-BU-01/i })).toBeInTheDocument();

    fireEvent.click(postsChip);
    expect(postsChip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /POSTE-BU-01/i })).not.toBeInTheDocument();
  });

  it('transitions in-place inside a single BottomSheet to CompanionChatView and returns via Voltar', () => {
    renderMapTab();

    // Single-Sheet Rule check before transition
    expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);

    // Join companion group toggle works
    const joinButtons = screen.getAllByRole('button', { name: /Entrar no grupo/i });
    fireEvent.click(joinButtons[0]);
    expect(screen.getByRole('button', { name: /^No grupo$/i })).toBeInTheDocument();

    // Click "Combinar trajeto" -> transitions in-place inside the same BottomSheet
    const chatButtons = screen.getAllByRole('button', { name: /Combinar trajeto/i });
    fireEvent.click(chatButtons[0]);

    // Still strictly ONE BottomSheet in DOM
    expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);
    const sheet = screen.getByTestId('bottom-sheet');

    // Route comparison disappears and chat view is active inside the sheet
    expect(within(sheet).queryByRole('button', { name: /Mais Iluminada/i })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Voltar/i })).toBeInTheDocument();
    expect(within(sheet).getByLabelText(/Mensagem para/i)).toBeInTheDocument();

    // Click Voltar -> restores route comparison & companion list in-place
    fireEvent.click(within(sheet).getByRole('button', { name: /Voltar/i }));
    expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);
    expect(within(sheet).getByRole('button', { name: /Mais Iluminada/i })).toBeInTheDocument();
    expect(within(sheet).getAllByRole('button', { name: /Combinar trajeto/i }).length).toBeGreaterThan(0);
  });

  it('blocks XSS payloads and oversized messages via Zod fail-fast while appending safe chat messages optimistically', () => {
    renderMapTab();

    const chatButtons = screen.getAllByRole('button', { name: /Combinar trajeto/i });
    fireEvent.click(chatButtons[0]);

    const input = screen.getByLabelText(/Mensagem para/i) as HTMLInputElement;
    const sendBtn = screen.getByRole('button', { name: /Enviar/i });

    // 1. Block <script> XSS attempt
    fireEvent.change(input, { target: { value: '<script>alert(1)</script>' } });
    fireEvent.click(sendBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/inválidos|scripts/i);
    expect(screen.queryByText('<script>alert(1)</script>')).not.toBeInTheDocument();

    // 2. Block javascript: scheme
    fireEvent.change(input, { target: { value: 'Clique em javascript:alert(1)' } });
    fireEvent.click(sendBtn);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // 3. Block > 240 chars
    fireEvent.change(input, { target: { value: 'a'.repeat(241) } });
    fireEvent.click(sendBtn);
    expect(screen.getByRole('alert')).toHaveTextContent(/240/);

    // 4. Send valid safe text optimistically
    fireEvent.change(input, { target: { value: 'Nos vemos na entrada da BU!' } });
    fireEvent.click(sendBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Nos vemos na entrada da BU!')).toBeInTheDocument();
    expect(input.value).toBe('');

    // 5. Quick-reply safe chip also appends optimistically (chip + message bubble = 2)
    const quickChip = screen.getByRole('button', { name: /Saio em 5 min/i });
    fireEvent.click(quickChip);
    expect(screen.getAllByText('Saio em 5 min')).toHaveLength(2);

    // Persisted in localStorage
    const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
    const firstCompanionId = stored.companionMatches[0].id;
    const savedTexts = (stored.chatMessages[firstCompanionId] || []).map(
      (m: { text: string }) => m.text
    );
    expect(savedTexts).toContain('Nos vemos na entrada da BU!');
    expect(savedTexts).toContain('Saio em 5 min');
    expect(savedTexts).not.toContain('<script>alert(1)</script>');
  });
});
