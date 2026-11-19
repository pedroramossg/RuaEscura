import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { CampusStoreProvider, useCampusStore } from '../hooks/useCampusStore';
import { MapTab } from '../components/map/MapTab';
import { getSeedCampusState } from '../data/ufscTrindade';
import { CAMPUS_STORAGE_KEY } from '../security/storage';

describe('Task 4: Interactive UFSC Map, Route Comparison, Companions & In-Sheet Chat', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    const chatLog = screen.getByRole('log');
    expect(within(chatLog).queryByText('<script>alert(1)</script>')).not.toBeInTheDocument();

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
    const savedTexts = Object.values(stored.chatMessages || {})
      .flat()
      .map((m) => (m as { text: string }).text);
    expect(savedTexts).toContain('Nos vemos na entrada da BU!');
    expect(savedTexts).toContain('Saio em 5 min');
    expect(savedTexts).not.toContain('<script>alert(1)</script>');
  });

  it('creates a real multi-member walking group, opens ChatThread, receives live typing & member reply, and toggles emoji reaction', () => {
    vi.useFakeTimers();
    renderMapTab();

    // Open inline Criar grupo form inside BottomSheet
    const createGroupBtn = screen.getByRole('button', { name: /Criar grupo/i });
    fireEvent.click(createGroupBtn);

    // Reject too-short / XSS group title cleanly
    const titleInput = screen.getByLabelText(/Nome do grupo/i);
    fireEvent.change(titleInput, { target: { value: 'Oi' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar e abrir chat/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Fill valid group name & departure time and create real group
    fireEvent.change(titleInput, { target: { value: 'Volta CTC Noturna' } });
    fireEvent.change(screen.getByLabelText(/Horário de saída/i), { target: { value: '21:45' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar e abrir chat/i }));

    // New group opens directly in UIArc ChatThread without Gov.br badge
    const sheet = screen.getByTestId('bottom-sheet');
    expect(within(sheet).getByText('Volta CTC Noturna')).toBeInTheDocument();
    expect(within(sheet).queryByText('Gov.br')).not.toBeInTheDocument();
    expect(within(sheet).getByRole('log')).toBeInTheDocument();

    // Send a message and verify live typing indicator + bidirectional peer reply after 550ms
    const input = within(sheet).getByLabelText(/Mensagem para Volta CTC Noturna/i);
    fireEvent.change(input, { target: { value: 'Estou saindo da entrada do CTC agora' } });
    fireEvent.click(within(sheet).getByRole('button', { name: /Enviar/i }));

    expect(within(sheet).getByText(/está digitando/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const chatLog = within(sheet).getByRole('log');
    expect(
      within(chatLog).getByText(/Combinado! Passo ali na entrada combinada/i)
    ).toBeInTheDocument();

    // Toggle an emoji reaction on a chat message
    const reactBtns = within(sheet).getAllByRole('button', { name: /^Reagir$/i });
    fireEvent.click(reactBtns[0]);
    const thumbsUp = within(sheet).getByRole('button', { name: /Reagir com 👍/i });
    fireEvent.click(thumbsUp);

    expect(within(sheet).getByRole('button', { name: /👍 1, incluindo você/i })).toBeInTheDocument();
  });

  it('exports safe Google Maps and Apple Maps walking directions URLs reflecting active route coordinates', () => {
    renderMapTab();

    const sheet = screen.getByTestId('bottom-sheet');
    const googleLink = within(sheet).getByRole('link', { name: /Abrir rota no Google Maps/i });
    const appleLink = within(sheet).getByRole('link', { name: /Abrir rota no Apple Maps/i });

    expect(googleLink).toHaveTextContent('Abrir no Google Maps');
    expect(appleLink).toHaveTextContent('Abrir no Apple Maps');
    expect(googleLink).toHaveAttribute('target', '_blank');
    expect(googleLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(appleLink).toHaveAttribute('target', '_blank');
    expect(appleLink).toHaveAttribute('rel', 'noopener noreferrer');

    const gHref = googleLink.getAttribute('href') || '';
    const aHref = appleLink.getAttribute('href') || '';

    expect(gHref).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
    expect(gHref).toContain('travelmode=walking');
    expect(gHref).toMatch(/origin=-27\.\d{6},-48\.\d{6}/);
    expect(gHref).toMatch(/destination=-27\.\d{6},-48\.\d{6}/);

    expect(aHref).toMatch(/^https:\/\/maps\.apple\.com\/\?/);
    expect(aHref).toMatch(/saddr=-27\.\d{6},-48\.\d{6}/);
    expect(aHref).toMatch(/daddr=-27\.\d{6},-48\.\d{6}/);
    expect(aHref).toContain('dirflg=w');

    // Switching destination updates exported URLs
    const destSelect = screen.getByLabelText(/^Destino$/i);
    fireEvent.change(destSelect, { target: { value: 'santos_dumont' } });
    const updatedGHref = googleLink.getAttribute('href') || '';
    const updatedAHref = appleLink.getAttribute('href') || '';
    expect(updatedGHref).not.toBe(gHref);
    expect(updatedAHref).not.toBe(aHref);
  });

  it('syncs global darkMode across CampusMap, RouteSheet, and Map HUD controls, and defaults companions filter off', () => {
    function GlobalDarkHarness() {
      const { toggleDarkMode } = useCampusStore();
      return (
        <>
          <button type="button" onClick={toggleDarkMode}>
            Alternar Dark Global
          </button>
          <MapTab />
        </>
      );
    }

    const seed = getSeedCampusState();
    seed.darkMode = false;
    seed.isNightMap = false;

    render(
      <CampusStoreProvider initialState={seed}>
        <GlobalDarkHarness />
      </CampusStoreProvider>
    );

    const mapEl = screen.getByTestId('campus-map');
    const sheetEl = screen.getByTestId('bottom-sheet');

    // Companions layer defaults to off to avoid covering building names; legend is present
    const companionsChip = screen.getByRole('button', { name: /^Colegas$/i });
    expect(companionsChip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /Colega de trajeto:/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Legenda do mapa/i)).toBeInTheDocument();

    fireEvent.click(companionsChip);
    expect(companionsChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /Colega de trajeto:/i }).length).toBeGreaterThan(0);

    // Enable global darkMode via store
    expect(mapEl).toHaveAttribute('data-night', 'false');
    expect(sheetEl.className).toContain('bg-white');

    fireEvent.click(screen.getByRole('button', { name: /Alternar Dark Global/i }));

    expect(mapEl).toHaveAttribute('data-night', 'true');
    expect(mapEl.className).toContain('bg-[#0A0A0A]');
    expect(sheetEl.className).toContain('bg-[#0B1120]');

    // Clicking Mapa Claro in Map HUD responds even when darkMode was toggled globally
    const dayToggle = screen.getByRole('button', { name: /Mapa Claro/i });
    fireEvent.click(dayToggle);
    expect(mapEl).toHaveAttribute('data-night', 'false');
    expect(sheetEl.className).toContain('bg-white');
  });

  it('supports women-only filter, auto-filters male emails on creation, WhatsApp invite link, and arrival check-in in chat', () => {
    const femaleSeed = getSeedCampusState();
    femaleSeed.userSession = {
      name: 'Mariana Silva',
      cpfMasked: '***.982.247-**',
      affiliation: 'CTC UFSC',
      ufscEmail: 'mariana.silva@grad.ufsc.br',
      verifiedAt: '2026-11-16T20:00:00Z',
    };

    renderMapTab(vi.fn(), femaleSeed);
    const sheet = screen.getByTestId('bottom-sheet');

    // Toggle Grupo Feminino filter (visible for verified female session)
    const womenFilterBtn = within(sheet).getByRole('button', { name: /Grupo Feminino/i });
    fireEvent.click(womenFilterBtn);
    expect(womenFilterBtn).toHaveAttribute('aria-pressed', 'true');
    expect(within(sheet).getByText(/Mariana Silva/i)).toBeInTheDocument();
    expect(within(sheet).queryByText(/Lucas Becker/i)).not.toBeInTheDocument();

    // Verify WhatsApp invite link carries safe wa.me URL
    const whatsappInvite = within(sheet).getAllByRole('link', { name: /Compartilhar no WhatsApp/i })[0]!;
    expect(whatsappInvite.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);

    // Reset filter and create women-only walking group with meetingPoint
    fireEvent.click(within(sheet).getByRole('button', { name: /^Todos/i }));
    fireEvent.click(within(sheet).getByRole('button', { name: /Criar grupo/i }));

    // Initially all 5 peers (including Lucas and Gabriel) are listed
    expect(within(sheet).getByRole('button', { name: /^Lucas$/i })).toBeInTheDocument();

    fireEvent.change(within(sheet).getByLabelText(/Nome do grupo/i), {
      target: { value: 'Volta CDS Segura' },
    });
    const meetingInput = within(sheet).getByLabelText(/Ponto de encontro/i);
    fireEvent.change(meetingInput, { target: { value: 'Portaria principal CDS' } });
    fireEvent.click(within(sheet).getByRole('button', { name: /Grupo feminino verificado/i }));

    // Toggling Grupo feminino automatically excludes male peers based on @ufsc.br email
    expect(within(sheet).queryByRole('button', { name: /^Lucas$/i })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /^Gabriel$/i })).not.toBeInTheDocument();
    expect(within(sheet).getByText(/Filtro por e-mail ativo/i)).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('button', { name: /Criar e abrir chat/i }));

    expect(within(sheet).getByText('Volta CDS Segura')).toBeInTheDocument();
    expect(within(sheet).getByText(/Portaria principal CDS/i)).toBeInTheDocument();

    // Send 1-tap arrival check-in inside CompanionChatView
    fireEvent.click(within(sheet).getByRole('button', { name: /Cheguei bem/i }));
    expect(within(sheet).getByText(/Cheguei bem ao destino pelo trajeto iluminado/i)).toBeInTheDocument();
  });

  it('hides women-only group options for male UFSC accounts and uses OSM CSS night tiles without Carto API watermark', () => {
    const maleSeed = getSeedCampusState();
    maleSeed.isNightMap = true;
    maleSeed.userSession = {
      name: 'Pedro Ramos',
      cpfMasked: '***.111.222-**',
      affiliation: 'CTC UFSC',
      ufscEmail: 'pedro.ramos@grad.ufsc.br',
      verifiedAt: '2026-11-16T20:00:00Z',
    };

    const { container } = renderMapTab(vi.fn(), maleSeed);
    const sheet = screen.getByTestId('bottom-sheet');

    // Male account never sees women-only filter or exclusive women-only toggle
    expect(within(sheet).queryByRole('button', { name: /Grupo Feminino/i })).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: /Criar grupo/i }));
    expect(within(sheet).queryByRole('button', { name: /Grupo feminino verificado/i })).not.toBeInTheDocument();

    // Dark map applies CSS night tiles without gated Carto dark tiles
    expect(container.querySelector('.rua-escura-night-tiles')).toBeInTheDocument();
  });
});
