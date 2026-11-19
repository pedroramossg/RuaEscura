import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CampusStoreProvider } from '../hooks/useCampusStore';
import { ExploreTab } from '../components/explore/ExploreTab';
import { LightsTab } from '../components/lights/LightsTab';
import { ReportsTab } from '../components/reports/ReportsTab';
import { ProfileSheet } from '../components/profile/ProfileSheet';
import { App } from '../App';
import { getSeedCampusState } from '../data/ufscTrindade';
import { CAMPUS_STORAGE_KEY } from '../security/storage';
import type { PersistedCampusState } from '../types/campus';

function createVerifiedState(): PersistedCampusState {
  const state = getSeedCampusState();
  return {
    ...state,
    onboardingCompleted: true,
    selectedBuildings: ['bu', 'ru', 'cce'],
    timeSlot: '21h–23h',
    userSession: {
      name: 'Mariana Silva',
      cpfMasked: '***.982.247-**',
      affiliation: 'Ciência da Computação • 6ª fase UFSC',
      verifiedAt: '2026-11-16T20:00:00Z',
    },
  };
}

describe('Task 5: Explore, Lights QR Reporter, Reports, ProfileSheet & App Shell', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('ExploreTab', () => {
    it('renders verified greeting, hero route summary, quick safe routes, rating bar, and triggers navigation', () => {
      const state = createVerifiedState();
      const onOpenMap = vi.fn();
      const onOpenLights = vi.fn();
      const onOpenReports = vi.fn();
      const onOpenProfile = vi.fn();
      const onNotify = vi.fn();

      render(
        <CampusStoreProvider initialState={state}>
          <ExploreTab
            onOpenMap={onOpenMap}
            onOpenLights={onOpenLights}
            onOpenReports={onOpenReports}
            onOpenProfile={onOpenProfile}
            onNotify={onNotify}
          />
        </CampusStoreProvider>
      );

      expect(screen.getByText(/Mariana/i)).toBeInTheDocument();
      expect(screen.queryByText('Gov.br')).not.toBeInTheDocument();
      expect(screen.getByText(/Campus em Grupo/i)).toBeInTheDocument();

      // Profile trigger button >= 44px
      const profileBtn = screen.getByRole('button', { name: /Abrir perfil/i });
      expect(profileBtn.className).toMatch(/min-h-\[44px\]/);
      fireEvent.click(profileBtn);
      expect(onOpenProfile).toHaveBeenCalledTimes(1);

      // Primary hero CTA to Map
      const heroMapBtn = screen.getByRole('button', { name: /Abrir rota no Mapa/i });
      fireEvent.click(heroMapBtn);
      expect(onOpenMap).toHaveBeenCalledTimes(1);

      // Rate edge lighting optimistically (rating 5)
      const rateBtn5 = screen.getByRole('button', { name: /Avaliar trecho com nota 5 de 5/i });
      fireEvent.click(rateBtn5);
      const storedAfterRate = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(storedAfterRate.edgeRatings['edge-bu-reitoria'].count).toBeGreaterThan(
        state.edgeRatings['edge-bu-reitoria'].count
      );
      expect(onNotify).toHaveBeenCalled();

      // Quick safe corridor card selects endpoints and opens Map
      const quickRouteCard = screen.getByRole('button', { name: /BU → Praça Santos Dumont/i });
      fireEvent.click(quickRouteCard);
      const storedAfterQuick = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(storedAfterQuick.activeOriginId).toBe('bu');
      expect(storedAfterQuick.activeDestinationId).toBe('santos_dumont');
      expect(onOpenMap).toHaveBeenCalledTimes(2);
    });
  });

  describe('LightsTab (QR Lamp Post Reporter)', () => {
    it('selects POSTE-BU-01 and tapping Queimado updates post status and route state optimistically', () => {
      const state = createVerifiedState();
      const onOpenMap = vi.fn();
      const onNotify = vi.fn();

      render(
        <CampusStoreProvider initialState={state}>
          <LightsTab onOpenMap={onOpenMap} onNotify={onNotify} />
        </CampusStoreProvider>
      );

      // Quick-select POSTE-BU-01 pill
      const quickPill = screen.getByRole('button', { name: /^POSTE-BU-01$/i });
      fireEvent.click(quickPill);

      const initialBanner = screen.getByText(/Rota iluminada atual:/i).textContent;

      // Tap Queimado button
      const queimadoBtn = screen.getByRole('button', { name: /^Queimado$/i });
      expect(queimadoBtn.className).toMatch(/min-h-\[44px\]/);
      fireEvent.click(queimadoBtn);

      expect(queimadoBtn).toHaveAttribute('aria-pressed', 'true');
      expect(onNotify).toHaveBeenCalledWith(expect.stringMatching(/POSTE-BU-01.*Queimado/i));
      const updatedBanner = screen.getByText(/Rota iluminada atual:/i).textContent;
      expect(updatedBanner).not.toBe(initialBanner);

      // Persisted optimistically in localStorage
      const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      const post = stored.posts.find((p: { id: string }) => p.id === 'POSTE-BU-01');
      expect(post?.status).toBe('queimado');

      // Directory filter shows burned post under Queimados filter
      const burnedFilter = screen.getByRole('button', { name: /Queimados/i });
      fireEvent.click(burnedFilter);
      const directoryList = screen.getByRole('list');
      expect(within(directoryList).getByText(/Poste BU Entrada Oeste/i)).toBeInTheDocument();
    });

    it('validates manual QR code input fail-fast via QrCodeInputSchema and blocks malicious/invalid inputs', () => {
      const state = createVerifiedState();

      render(
        <CampusStoreProvider initialState={state}>
          <LightsTab onOpenMap={vi.fn()} />
        </CampusStoreProvider>
      );

      const qrInput = screen.getByLabelText(/Código QR do poste/i) as HTMLInputElement;
      const scanBtn = screen.getByRole('button', { name: /Ler QR/i });

      // Malicious XSS attempt
      fireEvent.change(qrInput, { target: { value: '<script>alert(1)</script>' } });
      fireEvent.click(scanBtn);

      expect(screen.getByRole('alert')).toHaveTextContent(/inválido|formato/i);

      // Path traversal attempt
      fireEvent.change(qrInput, { target: { value: '../etc/passwd' } });
      fireEvent.click(scanBtn);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Valid QR code selects target post
      fireEvent.change(qrInput, { target: { value: 'POSTE-RU-03' } });
      fireEvent.click(scanBtn);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText(/Atualizar status de POSTE-RU-03/i)).toBeInTheDocument();
    });
  });

  describe('ReportsTab (Emergency Dialog, Zod XSS Defense, Safe Upload & Feed)', () => {
    it('opens explicit confirmation dialog showing (48) 3721-9555 and 190 without direct dialing', () => {
      const state = createVerifiedState();
      const onNotify = vi.fn();

      render(
        <CampusStoreProvider initialState={state}>
          <ReportsTab onNotify={onNotify} />
        </CampusStoreProvider>
      );

      // Emergency button must NOT be a tel: link
      const emergencyTrigger = screen.getByRole('button', { name: /Emergência UFSC \/ 190/i });
      expect(emergencyTrigger.tagName).toBe('BUTTON');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Clicking opens accessible confirmation dialog with UFSC Security & 190
      fireEvent.click(emergencyTrigger);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/\(48\) 3721-9555/)).toBeInTheDocument();
      expect(within(dialog).getByText(/\b190\b/)).toBeInTheDocument();

      // Confirming simulated alert triggers notification and closes dialog
      fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar alerta simulado/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onNotify).toHaveBeenCalledWith(expect.stringMatching(/3721-9555/));
    });

    it('blocks XSS payloads with inline role="alert" and appends valid confidential reports to feed', () => {
      const state = createVerifiedState();
      const onNotify = vi.fn();

      render(
        <CampusStoreProvider initialState={state}>
          <ReportsTab onNotify={onNotify} />
        </CampusStoreProvider>
      );

      const locationInput = screen.getByLabelText(/Local no campus/i) as HTMLInputElement;
      const descInput = screen.getByLabelText(/Descrição/i) as HTMLTextAreaElement;
      const submitBtn = screen.getByRole('button', { name: /Enviar denúncia segura/i });

      // 1. XSS payload blocked fail-fast
      fireEvent.change(locationInput, { target: { value: 'Passarela CCE' } });
      fireEvent.change(descInput, { target: { value: '<script>alert(1)</script>' } });
      fireEvent.click(submitBtn);

      expect(screen.getByRole('alert')).toHaveTextContent(/inválidos|scripts/i);
      const feedList = screen.getByRole('list');
      expect(within(feedList).queryByText('<script>alert(1)</script>')).not.toBeInTheDocument();

      // 1b. javascript: scheme blocked fail-fast
      fireEvent.change(descInput, { target: { value: 'Veja detalhes em javascript:alert(1)' } });
      fireEvent.click(submitBtn);
      expect(screen.getByRole('alert')).toHaveTextContent(/inválidos|scripts/i);
      expect(within(feedList).queryByText(/javascript:alert/i)).not.toBeInTheDocument();

      // 2. Valid report appends to community feed
      fireEvent.change(descInput, {
        target: { value: 'Dois postes apagados perto da passarela do CCE após as 21h.' },
      });
      fireEvent.click(submitBtn);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        within(feedList).getByText('Dois postes apagados perto da passarela do CCE após as 21h.')
      ).toBeInTheDocument();
      expect(onNotify).toHaveBeenCalled();

      // Persisted cleanly in localStorage
      const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.reports[0].locationName).toBe('Passarela CCE');
      expect(stored.reports[0].isConfidential).toBe(true);
    });

    it('rejects spoofed/oversized evidence files via validateEvidenceImage while preserving form state', async () => {
      const state = createVerifiedState();

      render(
        <CampusStoreProvider initialState={state}>
          <ReportsTab />
        </CampusStoreProvider>
      );

      const locationInput = screen.getByLabelText(/Local no campus/i) as HTMLInputElement;
      const descInput = screen.getByLabelText(/Descrição/i) as HTMLTextAreaElement;
      fireEvent.change(locationInput, { target: { value: 'Entrada RU' } });
      fireEvent.change(descInput, { target: { value: 'Poste com fiação exposta e luz falhando.' } });

      const fileInput = screen.getByLabelText(/Anexar foto de evidência/i) as HTMLInputElement;
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const spoofedFile = new File([exeBytes], 'evil.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [spoofedFile] } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/magic bytes|inválido/i);
      });

      // Form inputs remain intact
      expect(locationInput.value).toBe('Entrada RU');
      expect(descInput.value).toBe('Poste com fiação exposta e luz falhando.');

      // Reject > 5 MB file
      const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1);
      oversizedBytes[0] = 0xff;
      oversizedBytes[1] = 0xd8;
      oversizedBytes[2] = 0xff;
      const oversizedFile = new File([oversizedBytes], 'huge.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/5MB/i);
      });

      // Accept valid JPEG magic bytes (EXIF-stripped via fallback in jsdom)
      const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const validFile = new File([validJpegBytes], 'evidence.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByText(/Metadados EXIF removidos com segurança/i)).toBeInTheDocument();
      });

      // Submit the validated report with attached EXIF-stripped JPEG thumbnail
      const submitBtn = screen.getByRole('button', { name: /Enviar denúncia segura/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const thumbImg = screen.getByAltText(/Evidência em Entrada RU/i) as HTMLImageElement;
        expect(thumbImg).toBeInTheDocument();
        expect(thumbImg.getAttribute('src')).toMatch(/^data:image\/(webp|jpeg);base64,/);
      });
    });
  });

  describe('ProfileSheet (Masked CPF & Dual Reset Controls)', () => {
    it('displays masked CPF only, never raw digits, and separates session reset from full demo reset', () => {
      const state = createVerifiedState();
      // Add a custom report so we can verify resetSessionOnly preserves campus data vs resetAllDemoData restores seed
      state.reports = [
        {
          id: 'rep-custom-1',
          category: 'iluminacao',
          locationName: 'Praça da Cidadania',
          description: 'Lâmpada queimada no poste central',
          isConfidential: true,
          createdAt: '2026-11-16T21:00:00Z',
          status: 'pendente',
        },
        ...state.reports,
      ];

      const onClose = vi.fn();

      const { rerender } = render(
        <CampusStoreProvider initialState={state}>
          <ProfileSheet isOpen={true} onClose={onClose} />
        </CampusStoreProvider>
      );

      expect(screen.getByText('***.982.247-**')).toBeInTheDocument();
      expect(document.body.textContent).not.toContain('52998224725');
      expect(document.body.textContent).not.toContain('529.982.247-25');

      // Toggle Night Map and Haptics switches
      const nightSwitch = screen.getByRole('switch', { name: /Luz Noturna no mapa/i });
      const hapticsSwitch = screen.getByRole('switch', { name: /Feedback tátil/i });
      expect(nightSwitch).toHaveAttribute('aria-checked', 'false');
      expect(hapticsSwitch).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(nightSwitch);
      fireEvent.click(hapticsSwitch);
      expect(nightSwitch).toHaveAttribute('aria-checked', 'true');
      expect(hapticsSwitch).toHaveAttribute('aria-checked', 'false');

      // 1. Encerrar sessão Gov.br -> resets session/onboarding only, preserves reports
      fireEvent.click(screen.getByRole('button', { name: /Encerrar sessão Gov\.br/i }));
      expect(onClose).toHaveBeenCalledTimes(1);

      let stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.onboardingCompleted).toBe(false);
      expect(stored.userSession).toBeNull();
      expect(stored.reports[0].id).toBe('rep-custom-1');

      // Re-open with fresh provider holding the custom state to test full demo reset
      rerender(
        <CampusStoreProvider initialState={state}>
          <ProfileSheet isOpen={true} onClose={onClose} />
        </CampusStoreProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: /Resetar dados demo/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirmar restauração/i }));
      stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.onboardingCompleted).toBe(false);
      expect(stored.reports.length).toBe(getSeedCampusState().reports.length);
      expect(stored.reports[0].id).toBe('rep-init-1');
    });
  });

  describe('App Integration Smoke Tests', () => {
    it('renders OnboardingFlow when unverified', async () => {
      render(<App />);
      expect(
        await screen.findByRole('heading', { name: /Seja bem-vindo!/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Te apresentamos o Rua Escura/i)).toBeInTheDocument();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    it('renders 4-tab shell when verified, preserves single-sheet rule across tab switches', async () => {
      const verifiedState = createVerifiedState();
      localStorage.setItem(CAMPUS_STORAGE_KEY, JSON.stringify(verifiedState));

      render(<App />);

      // Returning verified user sees the WelcomeBackOverlay first, then enters Explorar
      const enterCampusBtn = await screen.findByRole('button', { name: /Entrar no campus/i });
      fireEvent.click(enterCampusBtn);

      // Starts in Explorar tab with 4-tab FloatingTabBar
      const tabs = await screen.findAllByRole('tab');
      expect(tabs).toHaveLength(4);
      expect(await screen.findByText(/Mariana/i)).toBeInTheDocument();
      expect(screen.queryAllByTestId('bottom-sheet')).toHaveLength(0);

      // Open ProfileSheet from Explorar -> strictly 1 modal BottomSheet, then dismiss via close button
      fireEvent.click(screen.getByRole('button', { name: /Abrir perfil/i }));
      expect(await screen.findAllByTestId('bottom-sheet', {}, { timeout: 10000 })).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: /Fechar perfil/i }));
      expect(screen.queryAllByTestId('bottom-sheet')).toHaveLength(0);

      // Switch to Mapa -> MapTab renders its own single non-modal RouteSheet
      fireEvent.click(screen.getByRole('tab', { name: /Mapa/i }));
      expect(await screen.findByTestId('campus-map')).toBeInTheDocument();
      expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);

      // Switch to Postes
      fireEvent.click(screen.getByRole('tab', { name: /Postes/i }));
      expect(await screen.findByText(/Postes & QR Code/i)).toBeInTheDocument();
      expect(screen.queryAllByTestId('bottom-sheet')).toHaveLength(0);

      // Switch to Denúncias
      fireEvent.click(screen.getByRole('tab', { name: /Denúncias/i }));
      expect(await screen.findByText(/Denúncias & Emergência/i)).toBeInTheDocument();

      // Switch back to Explorar, open ProfileSheet and reset session -> returns cleanly to OnboardingFlow
      fireEvent.click(screen.getByRole('tab', { name: /Explorar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /Abrir perfil/i }));
      fireEvent.click(await screen.findByRole('button', { name: /Encerrar sessão Gov\.br/i }));

      expect(
        await screen.findByRole('heading', { name: /Seja bem-vindo!/i })
      ).toBeInTheDocument();
    }, 15000);
  });
});
