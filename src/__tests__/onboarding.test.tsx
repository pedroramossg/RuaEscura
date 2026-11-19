import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampusStoreProvider, useCampusStore } from '../hooks/useCampusStore';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { getSeedCampusState } from '../data/ufscTrindade';
import { CAMPUS_STORAGE_KEY } from '../security/storage';

describe('Task 3: Reactive Campus Store & 4-Step Gov.br Conversion Onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('useCampusStore & CampusStoreProvider', () => {
    function TestConsumer() {
      const store = useCampusStore();
      return (
        <div>
          <span data-testid="onboarding-status">
            {store.onboardingCompleted ? 'completed' : 'pending'}
          </span>
          <span data-testid="active-origin">{store.activeOriginId}</span>
          <span data-testid="active-destination">{store.activeDestinationId}</span>
          <span data-testid="route-mode">{store.routeMode}</span>
          <span data-testid="is-night-map">{store.isNightMap ? 'yes' : 'no'}</span>
          <span data-testid="haptics-enabled">{store.hapticsEnabled ? 'yes' : 'no'}</span>
          <span data-testid="session-name">{store.userSession?.name ?? 'none'}</span>
          <span data-testid="session-cpf">{store.userSession?.cpfMasked ?? 'none'}</span>
          <span data-testid="reports-count">{store.reports.length}</span>
          <span data-testid="posts-count">{store.posts.length}</span>
          <span data-testid="active-route-illumination">
            {store.activeRoute.illuminationPercentage}
          </span>
          <span data-testid="active-route-distance">{store.activeRoute.distanceMeters}</span>

          <button
            onClick={() =>
              store.completeOnboarding({
                selectedBuildings: ['bu', 'cse'],
                timeSlot: '19h–21h',
                isNightMap: true,
                session: {
                  name: 'Mariana Silva',
                  cpfMasked: '***.982.247-**',
                  affiliation: 'Engenharia • 5ª fase',
                  verifiedAt: '2026-11-16T12:00:00Z',
                },
              })
            }
          >
            Trigger Complete
          </button>

          <button onClick={() => store.updateLampPostStatus('POSTE-BU-01', 'queimado')}>
            Burn BU Post
          </button>

          <button onClick={() => store.rateEdgeLighting('edge-bu-reitoria', 1)}>
            Rate Edge Bad
          </button>

          <button
            onClick={() =>
              store.submitReport({
                category: 'iluminacao',
                location: 'Entrada CCE',
                description: 'Poste apagado próximo à entrada principal',
                isConfidential: true,
              })
            }
          >
            Submit Report
          </button>

          <button onClick={() => store.toggleJoinCompanion('comp-1')}>
            Toggle Companion
          </button>

          <button onClick={() => store.sendChatMessage('comp-1', 'Olá, estou a caminho!')}>
            Send Message
          </button>

          <button onClick={() => store.setRouteEndpoints('cce', 'ru')}>
            Change Endpoints
          </button>

          <button onClick={() => store.swapEndpoints()}>Swap Endpoints</button>
          <button onClick={() => store.setRouteMode('fastest')}>Set Fastest Mode</button>
          <button onClick={() => store.toggleNightMap()}>Toggle Night</button>
          <button onClick={() => store.setHapticsEnabled(false)}>Disable Haptics</button>
          <button onClick={() => store.resetSessionOnly()}>Reset Session Only</button>
          <button onClick={() => store.resetAllDemoData()}>Reset All Data</button>
        </div>
      );
    }

    it('hydrates default seed state and computes routes reactively', () => {
      render(
        <CampusStoreProvider>
          <TestConsumer />
        </CampusStoreProvider>
      );

      expect(screen.getByTestId('onboarding-status').textContent).toBe('pending');
      expect(screen.getByTestId('active-origin').textContent).toBe('bu');
      expect(screen.getByTestId('active-destination').textContent).toBe('ru');
      expect(screen.getByTestId('route-mode').textContent).toBe('brightest');
      expect(Number(screen.getByTestId('active-route-distance').textContent)).toBeGreaterThan(0);
      expect(Number(screen.getByTestId('active-route-illumination').textContent)).toBeGreaterThan(0);
    });

    it('performs optimistic updates for lamp post status and recalculates routes', () => {
      render(
        <CampusStoreProvider>
          <TestConsumer />
        </CampusStoreProvider>
      );

      const initialIllum = Number(screen.getByTestId('active-route-illumination').textContent);

      // Burn BU post
      fireEvent.click(screen.getByText('Burn BU Post'));

      // Recalculates illumination downwards or updates route
      const updatedIllum = Number(screen.getByTestId('active-route-illumination').textContent);
      expect(updatedIllum).toBeLessThanOrEqual(initialIllum);

      // Verify persisted to localStorage
      const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      const post = stored.posts.find((p: { id: string }) => p.id === 'POSTE-BU-01');
      expect(post?.status).toBe('queimado');
    });

    it('performs edge lighting ratings with fail-fast validation', () => {
      render(
        <CampusStoreProvider>
          <TestConsumer />
        </CampusStoreProvider>
      );

      fireEvent.click(screen.getByText('Rate Edge Bad'));

      const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.edgeRatings['edge-bu-reitoria']).toBeDefined();
    });

    it('submits reports optimistically and prepends them with random UUID', () => {
      render(
        <CampusStoreProvider>
          <TestConsumer />
        </CampusStoreProvider>
      );

      const initialCount = Number(screen.getByTestId('reports-count').textContent);
      fireEvent.click(screen.getByText('Submit Report'));

      expect(Number(screen.getByTestId('reports-count').textContent)).toBe(initialCount + 1);

      const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.reports[0].description).toBe('Poste apagado próximo à entrada principal');
      expect(stored.reports[0].id).toBeDefined();
    });

    it('toggles companion joining and appends validated chat messages', () => {
      render(
        <CampusStoreProvider>
          <TestConsumer />
        </CampusStoreProvider>
      );

      fireEvent.click(screen.getByText('Toggle Companion'));
      let stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      const comp = stored.companionMatches.find((c: { id: string }) => c.id === 'comp-1');
      expect(comp?.isUserJoined).toBe(true);

      fireEvent.click(screen.getByText('Send Message'));
      stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      const msgs = stored.chatMessages['comp-1'];
      expect(msgs[msgs.length - 1].text).toBe('Olá, estou a caminho!');
    });

    it('changes and swaps route endpoints, toggles night map and route modes', () => {
      render(
        <CampusStoreProvider>
          <TestConsumer />
        </CampusStoreProvider>
      );

      fireEvent.click(screen.getByText('Change Endpoints'));
      expect(screen.getByTestId('active-origin').textContent).toBe('cce');
      expect(screen.getByTestId('active-destination').textContent).toBe('ru');

      fireEvent.click(screen.getByText('Swap Endpoints'));
      expect(screen.getByTestId('active-origin').textContent).toBe('ru');
      expect(screen.getByTestId('active-destination').textContent).toBe('cce');

      fireEvent.click(screen.getByText('Set Fastest Mode'));
      expect(screen.getByTestId('route-mode').textContent).toBe('fastest');

      fireEvent.click(screen.getByText('Toggle Night'));
      expect(screen.getByTestId('is-night-map').textContent).toBe('yes');

      fireEvent.click(screen.getByText('Disable Haptics'));
      expect(screen.getByTestId('haptics-enabled').textContent).toBe('no');
    });

    it('resetSessionOnly clears session while preserving campus modifications, while resetAllDemoData restores seed', () => {
      render(
        <CampusStoreProvider>
          <TestConsumer />
        </CampusStoreProvider>
      );

      // Complete onboarding and add a report
      fireEvent.click(screen.getByText('Trigger Complete'));
      fireEvent.click(screen.getByText('Submit Report'));

      expect(screen.getByTestId('onboarding-status').textContent).toBe('completed');
      expect(screen.getByTestId('session-name').textContent).toBe('Mariana Silva');

      // Reset session only
      fireEvent.click(screen.getByText('Reset Session Only'));
      expect(screen.getByTestId('onboarding-status').textContent).toBe('pending');
      expect(screen.getByTestId('session-name').textContent).toBe('none');

      // Reports count should still have the submitted report!
      let stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.reports.length).toBeGreaterThan(getSeedCampusState().reports.length);

      // Reset all demo data
      fireEvent.click(screen.getByText('Reset All Data'));
      stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.reports.length).toBe(getSeedCampusState().reports.length);
    });
  });

  describe('OnboardingFlow 4-Step Conversion & Gov.br Gate', () => {
    it('Focus Flight Intro: advances through all 5 beats into Step 1, supports Voltar, and jumps straight to Step 4 via Gov.br shortcut', async () => {
      const { unmount } = render(
        <CampusStoreProvider>
          <OnboardingFlow />
        </CampusStoreProvider>
      );

      // Beat 0: Welcome
      expect(screen.getByRole('heading', { name: /Seja bem-vindo!/i })).toBeInTheDocument();
      expect(screen.getByText(/Te apresentamos o Rua Escura/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Já tenho conta Gov\.br/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Olá!$/i }));

      // Beat 1: Safety feeling
      expect(screen.getByRole('heading', { name: /inseguro\(a\) na UFSC\?/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Às vezes/i })).toBeInTheDocument();

      // Verify back button works and returns to Beat 0
      fireEvent.click(screen.getByRole('button', { name: /Voltar/i }));
      expect(screen.getByRole('heading', { name: /Seja bem-vindo!/i })).toBeInTheDocument();

      // Advance Beat 0 -> Beat 1 -> Beat 2
      fireEvent.click(screen.getByRole('button', { name: /^Olá!$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Sim, já senti\./i }));

      // Beat 2: Night fear (Sim / Não pills)
      expect(screen.getByRole('heading', { name: /medo ao andar à noite\?/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sim$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Não$/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Sim$/i }));

      // Beat 3: Solution
      expect(screen.getByRole('heading', { name: /Rua Escura\./i })).toBeInTheDocument();
      expect(screen.getByText(/Rotas iluminadas em tempo real/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Qual é a chave\?/i }));

      // Beat 4: The Key -> Finish Intro into Step 1
      expect(
        screen.getByRole('heading', { name: /A chave para andar tranquilo\(a\)\?/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Caminhos iluminados, alertas reais da comunidade/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Começar meu cadastro/i }));

      // Enters Wizard Step 1
      expect(
        await screen.findByRole('heading', {
          name: /Caminhe pela UFSC no claro\. E acompanhado\./i,
        })
      ).toBeInTheDocument();

      unmount();

      // Fresh mount: "Já tenho conta Gov.br" jumps straight from Intro Beat 0 to Step 4
      render(
        <CampusStoreProvider>
          <OnboardingFlow />
        </CampusStoreProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: /Já tenho conta Gov\.br/i }));
      expect(await screen.findByText(/Validação única Gov\.br/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/CPF/i)).toBeInTheDocument();
    });

    it('Step 1: renders outcome promise and shortcut button jumping directly to Step 4', () => {
      render(
        <CampusStoreProvider>
          <OnboardingFlow initialStage="wizard" />
        </CampusStoreProvider>
      );

      // Outcome headline
      expect(
        screen.getByRole('heading', {
          name: /Caminhe pela UFSC no claro\. E acompanhado\./i,
        })
      ).toBeInTheDocument();

      // Primary CTA
      const startBtn = screen.getByRole('button', { name: /Começar meu trajeto/i });
      expect(startBtn).toBeInTheDocument();

      // Shortcut to Step 4
      const govBrShortcut = screen.getByRole('button', { name: /Já tenho conta Gov\.br/i });
      expect(govBrShortcut).toBeInTheDocument();

      // Click shortcut -> directly enters Step 4 (Gov.br Gate)
      fireEvent.click(govBrShortcut);
      expect(screen.getByText(/Validação única Gov\.br/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/CPF/i)).toBeInTheDocument();
    });

    it('Step 2: selects multiple UFSC buildings, time slot, and "Sempre Noturno" mode', () => {
      render(
        <CampusStoreProvider>
          <OnboardingFlow initialStage="wizard" />
        </CampusStoreProvider>
      );

      // Start flow to Step 2
      fireEvent.click(screen.getByRole('button', { name: /Começar meu trajeto/i }));

      // Step 2 headline
      expect(screen.getByText(/Seus trajetos e horários frequentes/i)).toBeInTheDocument();

      // Building chips toggle
      const chipRU = screen.getByRole('button', { name: /RU/i });
      const chipBU = screen.getByRole('button', { name: /BU/i });
      const chipCCE = screen.getByRole('button', { name: /CCE/i });
      const chipCSE = screen.getByRole('button', { name: /CSE/i });

      expect(chipRU).toBeInTheDocument();
      expect(chipBU).toBeInTheDocument();
      expect(chipCCE).toBeInTheDocument();
      expect(chipCSE).toBeInTheDocument();

      // Toggle CSE
      fireEvent.click(chipCSE);

      // Time slot selection
      const timeSlotBtn = screen.getByRole('button', { name: /21h–23h/i });
      expect(timeSlotBtn).toBeInTheDocument();
      fireEvent.click(timeSlotBtn);

      // Map style mode: Sempre Noturno
      const nightModeBtn = screen.getByRole('button', { name: /Sempre Noturno/i });
      expect(nightModeBtn).toBeInTheDocument();
      fireEvent.click(nightModeBtn);

      // Advance to Step 3
      const step2Next = screen.getByRole('button', { name: /Ver meu trajeto seguro/i });
      fireEvent.click(step2Next);

      // Arrives at Step 3
      expect(screen.getByText(/Seu corredor inteligente/i)).toBeInTheDocument();
    });

    it('Step 3: displays live Aha! preview with % iluminado and verified peers BEFORE requiring login', () => {
      render(
        <CampusStoreProvider>
          <OnboardingFlow initialStage="wizard" />
        </CampusStoreProvider>
      );

      // Navigate Step 1 -> Step 2 -> Step 3
      fireEvent.click(screen.getByRole('button', { name: /Começar meu trajeto/i }));
      fireEvent.click(screen.getByRole('button', { name: /Ver meu trajeto seguro/i }));

      // Live Aha! preview indicators
      expect(screen.getByText(/% iluminado/i)).toBeInTheDocument();
      expect(screen.getByText(/estudantes verificados/i)).toBeInTheDocument();
      expect(screen.getByText(/min a pé/i)).toBeInTheDocument();

      // Proceed to Step 4
      const step3Next = screen.getByRole('button', {
        name: /Validar acesso Gov\.br/i,
      });
      fireEvent.click(step3Next);

      // Should now be on Step 4
      expect(screen.getByText(/Validação única Gov\.br/i)).toBeInTheDocument();
    });

    it('Step 4 + Step 5: renders WelcomeBack Trio crew without campus GPS prompt, validates CPF fail-fast, transitions to "Tudo pronto!", and completes onboarding with masked CPF', async () => {
      const handleComplete = vi.fn();

      const { container } = render(
        <CampusStoreProvider>
          <OnboardingFlow initialStage="wizard" onComplete={handleComplete} />
        </CampusStoreProvider>
      );

      // Jump directly to Step 4 via shortcut
      fireEvent.click(screen.getByRole('button', { name: /Já tenho conta Gov\.br/i }));

      // 1. All 3 WelcomeBack Trio animated SVG characters render in Step 4
      for (const id of ['blue', 'gold', 'pink']) {
        expect(container.querySelector(`[data-member="${id}"]`)).toBeInTheDocument();
      }
      expect(container.querySelectorAll('[data-member]')).toHaveLength(3);

      // Verify "Localização no campus" / "Continuar para localização" were completely removed from Login
      expect(screen.queryByRole('button', { name: /Continuar para localização/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Localização no campus/i)).not.toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Nome completo/i);
      const affiliationInput = screen.getByLabelText(/Vínculo UFSC/i);
      const cpfInput = screen.getByLabelText(/CPF/i);
      const submitBtn = screen.getByRole('button', { name: /Validar e entrar/i });

      // 2. Test fail-fast invalid CPF + crew error state
      fireEvent.change(nameInput, { target: { value: 'Carlos Silva' } });
      fireEvent.change(affiliationInput, { target: { value: 'Engenharia Mecânica' } });
      fireEvent.change(cpfInput, { target: { value: '111.111.111-11' } }); // invalid repeated sequence
      fireEvent.click(submitBtn);

      expect(screen.getByRole('alert')).toHaveTextContent(/CPF inválido/i);
      expect(screen.getByText(/Ops! Confira os campos destacados/i)).toBeInTheDocument();
      expect(handleComplete).not.toHaveBeenCalled();

      // 3. Click "Preencher demo Gov.br", submit, verify checklist -> Step 5 "Tudo pronto, Mariana!"
      const demoBtn = screen.getByRole('button', { name: /Preencher demo Gov\.br/i });
      fireEvent.click(demoBtn);

      expect((nameInput as HTMLInputElement).value).toBe('Mariana Silva');
      expect((cpfInput as HTMLInputElement).value).toBe('529.982.247-25');
      expect((affiliationInput as HTMLInputElement).value).toContain('UFSC');
      expect(screen.getByLabelText(/CPF válido/i)).toBeInTheDocument();

      fireEvent.click(submitBtn);

      // Verification checklist items should appear
      await waitFor(() => {
        expect(screen.getByText(/Identidade Gov\.br validada/i)).toBeInTheDocument();
        expect(screen.getByText(/Vínculo UFSC confirmado/i)).toBeInTheDocument();
        expect(screen.getByText(/Selo Verificado ativo/i)).toBeInTheDocument();
      });

      // After verification sequence finishes, transitions to Step 5 "Tudo pronto, Mariana!" (Conectado) with centered WelcomeBack Trio
      await waitFor(
        () => {
          expect(screen.getByRole('heading', { name: /Tudo pronto, Mariana!/i })).toBeInTheDocument();
          expect(screen.getByText(/^Conectado$/i)).toBeInTheDocument();
          expect(screen.getByText(/\*\*\*\.982\.247-\*\*/)).toBeInTheDocument();
          expect(screen.getByTestId('welcome-back-trio-centered')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Does not finalize until user taps "Entrar no campus"
      expect(handleComplete).not.toHaveBeenCalled();

      // 4. Tap "Entrar no campus" -> completes onboarding with masked CPF only
      const enterBtn = screen.getByRole('button', { name: /Entrar no campus/i });
      fireEvent.click(enterBtn);

      expect(handleComplete).toHaveBeenCalledTimes(1);

      // Verify privacy requirement: raw CPF was NEVER saved in localStorage!
      const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
      expect(stored.onboardingCompleted).toBe(true);
      expect(stored.userSession.cpfMasked).toBe('***.982.247-**');
      expect(JSON.stringify(stored)).not.toContain('52998224725');
      expect(JSON.stringify(stored)).not.toContain('529.982.247-25');
    });
  });
});
