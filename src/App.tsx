import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CampusStoreProvider, useCampusStore } from './hooks/useCampusStore';
import { useHaptics } from './hooks/useHaptics';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { FloatingTabBar, TabId } from './components/ui/FloatingTabBar';
import { TabSkeleton } from './components/ui/Skeleton';
import { initPerfObservers } from './utils/perfMonitor';
import type { PersistedCampusState } from './types/campus';

const OnboardingFlow = lazy(() =>
  import('./components/onboarding/OnboardingFlow').then((m) => ({ default: m.OnboardingFlow }))
);
const WelcomeBackOverlay = lazy(() =>
  import('./components/onboarding/WelcomeBackOverlay').then((m) => ({
    default: m.WelcomeBackOverlay,
  }))
);
const ExploreTab = lazy(() =>
  import('./components/explore/ExploreTab').then((m) => ({ default: m.ExploreTab }))
);
const MapTab = lazy(() =>
  import('./components/map/MapTab').then((m) => ({ default: m.MapTab }))
);
const LightsTab = lazy(() =>
  import('./components/lights/LightsTab').then((m) => ({ default: m.LightsTab }))
);
const ReportsTab = lazy(() =>
  import('./components/reports/ReportsTab').then((m) => ({ default: m.ReportsTab }))
);
const ProfileSheet = lazy(() =>
  import('./components/profile/ProfileSheet').then((m) => ({ default: m.ProfileSheet }))
);

export interface AppProps {
  initialState?: PersistedCampusState;
}

/**
 * Inner reactive application shell consuming CampusStoreProvider.
 */
export function AppShell() {
  const {
    onboardingCompleted,
    isNightMap,
    darkMode,
    hapticsEnabled,
    posts,
    reports,
    timeSlot,
    userSession,
  } = useCampusStore();

  const haptics = useHaptics();
  const [activeTab, setActiveTab] = useState<TabId>('explorar');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState<boolean>(onboardingCompleted);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const cleanupObservers = initPerfObservers();
    return () => {
      cleanupObservers();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!onboardingCompleted) {
      setIsProfileOpen(false);
      setActiveTab('explorar');
    }
  }, [onboardingCompleted]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const notify = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  const handleTabChange = useCallback(
    (nextTab: TabId) => {
      setIsProfileOpen(false);
      if (hapticsEnabled) {
        haptics.trigger('selection');
      }
      setActiveTab(nextTab);
    },
    [haptics, hapticsEnabled]
  );

  const alertCount = useMemo(() => {
    const activeReports = reports.filter((r) => r.status !== 'resolvido').length;
    const burnedPosts = posts.filter((p) => p.status === 'queimado').length;
    return activeReports + burnedPosts;
  }, [reports, posts]);

  if (!onboardingCompleted) {
    return (
      <main className="min-h-screen bg-[var(--bg-grouped)] text-[var(--label-primary)]">
        <Suspense fallback={<TabSkeleton label="Carregando boas-vindas..." />}>
          <OnboardingFlow
            onComplete={() => {
              setShowWelcomeBack(false);
              notify('Bem-vindo ao RuaEscura UFSC Trindade.');
            }}
          />
        </Suspense>
      </main>
    );
  }

  if (showWelcomeBack) {
    return (
      <main className="min-h-screen bg-[var(--bg-grouped)] text-[var(--label-primary)]">
        <Suspense fallback={<TabSkeleton label="Preparando seu campus..." />}>
          <WelcomeBackOverlay
            userName={userSession?.name}
            timeSlot={timeSlot}
            safeRoutesCount={posts.filter((p) => p.status === 'aceso').length}
            onContinue={(targetTab) => {
              setShowWelcomeBack(false);
              if (targetTab) setActiveTab(targetTab);
            }}
          />
        </Suspense>
      </main>
    );
  }

  const isMapTab = activeTab === 'mapa';
  const isDarkSurface = darkMode || (isMapTab && isNightMap);

  return (
    <div
      className={`min-h-screen relative transition-colors duration-200 ${
        darkMode
          ? 'bg-[#0A0A0A] text-[#E5E4E2]'
          : isMapTab && isNightMap
            ? 'bg-[#0B1120] text-[#F8FAFC]'
            : 'bg-[var(--bg-grouped)] text-[var(--label-primary)]'
      }`}
    >

      {/* Global Polite Liquid Glass Status Pill */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed inset-x-4 z-[55] pointer-events-none flex justify-center"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <AnimatePresence mode="wait">
          {toastMessage && (
            <motion.div
              key={toastMessage}
              role="status"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -14, scale: 0.94 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -10, scale: 0.96 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0.12 }
                  : { type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }
              }
              className={`max-w-md w-fit px-4 py-2.5 rounded-full inline-flex items-center gap-2 text-xs sm:text-sm font-medium tracking-[-0.01em] ${
                isDarkSurface
                  ? 'liquid-glass-dark text-[#E5E4E2]'
                  : 'liquid-glass text-[var(--label-primary)]'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-[#10B981] shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.55)]"
              />
              <span className="leading-snug">{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active Tab Content (MapTab is unmounted on other tabs to preserve single-sheet rule) */}
      <main>
        <Suspense fallback={<TabSkeleton />}>
          <motion.div
            key={activeTab}
            initial={
              prefersReducedMotion
                ? false
                : isMapTab
                  ? { opacity: 0 }
                  : { opacity: 0, y: 10, filter: 'blur(4px)' }
            }
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { duration: 0.24, ease: [0.23, 1, 0.32, 1] }
            }
          >
            {activeTab === 'explorar' && (
              <ExploreTab
                onOpenMap={() => handleTabChange('mapa')}
                onOpenLights={() => handleTabChange('postes')}
                onOpenReports={() => handleTabChange('denuncias')}
                onOpenProfile={() => setIsProfileOpen(true)}
                profileTriggerRef={profileTriggerRef}
                onNotify={notify}
              />
            )}

            {activeTab === 'mapa' && (
              <MapTab onOpenReportsShortcut={() => handleTabChange('denuncias')} />
            )}

            {activeTab === 'postes' && (
              <LightsTab
                onOpenMap={() => handleTabChange('mapa')}
                onNotify={notify}
              />
            )}

            {activeTab === 'denuncias' && <ReportsTab onNotify={notify} />}
          </motion.div>
        </Suspense>
      </main>

      {/* Single-Sheet Profile Drawer (only rendered when opened outside MapTab) */}
      {isProfileOpen && !isMapTab && (
        <Suspense fallback={null}>
          <ProfileSheet
            isOpen={true}
            dark={isDarkSurface}
            onClose={() => setIsProfileOpen(false)}
            onOpenWelcomeBack={() => {
              setIsProfileOpen(false);
              setShowWelcomeBack(true);
            }}
            returnFocusRef={profileTriggerRef}
            onNotify={notify}
          />
        </Suspense>
      )}

      {/* Persistent Floating Liquid Glass Tab Bar */}
      <FloatingTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        alertCount={alertCount}
        dark={isDarkSurface}
      />
    </div>
  );
}

/**
 * Root RuaEscura application shell wrapped in CampusStoreProvider.
 */
export function App({ initialState }: AppProps) {
  return (
    <CampusStoreProvider initialState={initialState}>
      <AppShell />
    </CampusStoreProvider>
  );
}

export default App;
