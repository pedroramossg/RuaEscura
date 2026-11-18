import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Scrub } from '../components/ui/TimeScrubber';
import { SlideConfirm } from '../components/ui/SlideToConfirm';
import { RouteStatusCard } from '../components/explore/RouteStatusCard';
import { ExploreTab } from '../components/explore/ExploreTab';
import { CampusStoreProvider } from '../hooks/useCampusStore';
import { getSeedCampusState } from '../data/ufscTrindade';
import { CAMPUS_STORAGE_KEY } from '../security/storage';
import { ScheduledDepartureSchema } from '../security/schemas';

function createVerifiedState() {
  const base = getSeedCampusState();
  return {
    ...base,
    onboardingCompleted: true,
    activeOriginId: 'bu',
    activeDestinationId: 'ru',
    userSession: {
      name: 'Mariana Silva',
      cpfMasked: '***.456.789-**',
      affiliation: 'Ciência da Computação • 6ª fase UFSC',
      verifiedAt: '2026-11-18T00:00:00.000Z',
    },
  };
}

describe('v5 RouteStatusCard, Bencho TimeScrubber & SlideToConfirm, UIArc BottomSheet', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('validates scheduled departure times via ScheduledDepartureSchema fail-fast', () => {
    expect(
      ScheduledDepartureSchema.safeParse({
        time: '21:30',
        updatedAt: '2026-11-18T00:00:00.000Z',
      }).success
    ).toBe(true);

    expect(
      ScheduledDepartureSchema.safeParse({
        time: '25:99',
        updatedAt: '2026-11-18T00:00:00.000Z',
      }).success
    ).toBe(false);

    expect(
      ScheduledDepartureSchema.safeParse({
        time: '<script>',
        updatedAt: '2026-11-18T00:00:00.000Z',
      }).success
    ).toBe(false);
  });

  it('renders light-mode RouteStatusCard with dot-matrix codes, swap, schedule & details callbacks', () => {
    const onSwap = vi.fn();
    const onSchedule = vi.fn();
    const onDetails = vi.fn();

    render(
      <RouteStatusCard
        originShort="BU"
        destShort="RU"
        originName="Biblioteca Central"
        destName="Restaurante Universitário"
        estimatedMinutes={8}
        distanceMeters={583}
        litPostsCount={8}
        totalPostsCount={8}
        companionsCount={5}
        hasDarkWarning={false}
        progress={94}
        scheduledTime="21:30"
        timeSlot="21h–23h"
        onSwapRoute={onSwap}
        onOpenSchedule={onSchedule}
        onOpenDetails={onDetails}
      />
    );

    expect(screen.getByLabelText('BU')).toBeInTheDocument();
    expect(screen.getByLabelText('RU')).toBeInTheDocument();
    expect(screen.getByText('Saída 21:30')).toBeInTheDocument();
    expect(screen.getByText(/~8 min • 583 m/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Inverter origem e destino/i }));
    expect(onSwap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Horário marcado: 21:30/i }));
    expect(onSchedule).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Detalhes da rota/i }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it('scrubs 24h steps in Bencho TimeScrubber via keyboard arrows and calls onChange', async () => {
    const onChange = vi.fn();
    render(<Scrub format="24h" step="15" start={21 * 60} onChange={onChange} />);

    const slider = screen.getByRole('slider', { name: /Horário/i });
    expect(slider).toHaveAttribute('aria-valuetext', '21:00');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('commits Bencho SlideConfirm and triggers onConfirm callback', () => {
    const onConfirm = vi.fn();
    render(
      <SlideConfirm
        label="Deslize p/ sair às 21:30"
        confirmedLabel="Marcado • 21:30"
        onConfirm={onConfirm}
      />
    );

    const grip = screen.getByRole('button', { name: /Deslize p\/ sair às 21:30/i });
    fireEvent.keyDown(grip, { key: 'Enter' });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Marcado • 21:30/i })).toBeInTheDocument();
  });

  it('opens UIArc BottomSheet for Schedule Departure, persists HH:MM, and switches to Route Details cleanly (Single-Sheet Rule)', async () => {
    const state = createVerifiedState();
    const onNotify = vi.fn();

    render(
      <CampusStoreProvider initialState={state}>
        <ExploreTab
          onOpenMap={vi.fn()}
          onOpenLights={vi.fn()}
          onOpenReports={vi.fn()}
          onOpenProfile={vi.fn()}
          onNotify={onNotify}
        />
      </CampusStoreProvider>
    );

    // Initially no bottom sheet open
    expect(screen.queryAllByTestId('bottom-sheet')).toHaveLength(0);

    // Open Schedule Departure menu via RouteStatusCard
    fireEvent.click(screen.getByRole('button', { name: /Marcar horário para sair/i }));
    expect(await screen.findAllByTestId('bottom-sheet', {}, { timeout: 5000 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { name: /Marcar horário para sair/i })
    ).toBeInTheDocument();

    // Select 22:00 preset chip and slide to confirm
    fireEvent.click(screen.getByRole('button', { name: '22:00' }));
    const confirmGrip = screen.getByRole('button', { name: /Deslize p\/ sair às 22:00/i });
    fireEvent.keyDown(confirmGrip, { key: 'Enter' });

    // Persisted in localStorage & celebratory status shown
    const stored = JSON.parse(localStorage.getItem(CAMPUS_STORAGE_KEY) || '{}');
    expect(stored.scheduledDeparture?.time).toBe('22:00');
    expect(screen.getByText(/Saída marcada para 22:00/i)).toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledWith(expect.stringMatching(/Saída marcada para 22:00/i));

    // Switch in-place inside the same BottomSheet to Route Details
    fireEvent.click(screen.getByRole('button', { name: /Ver postes e trechos desta rota/i }));
    expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);
    expect(screen.getByText(/Segmentos do caminho/i)).toBeInTheDocument();
    expect(screen.getByText(/Postes monitorados no trajeto/i)).toBeInTheDocument();
  }, 15000);
});
