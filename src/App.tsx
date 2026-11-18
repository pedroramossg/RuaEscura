import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
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
      <main className="min-h-screen bg-[#F6F8FC] text-[#111827]">
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
      <main className="min-h-screen bg-[#F6F8FC] text-[#111827]">
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

  return (
    <div
      className={`min-h-screen relative transition-colors duration-200 ${
        isMapTab && isNightMap
          ? 'bg-[#0B1120] text-[#F8FAFC]'
          : 'bg-[#F6F8FC] text-[#111827]'
      }`}
    >

      {/* Global Polite Toast Announcer positioned above FloatingTabBar so top headings are never obscured */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-24 inset-x-4 z-[55] pointer-events-none flex justify-center"
      >
        {toastMessage && (
          <div
            role="status"
            className="t-toast is-open max-w-md w-fit px-4 py-2.5 rounded-full bg-[#111827] text-white text-xs sm:text-sm font-medium shadow-lg border border-white/15"
          >
            {toastMessage}
          </div>
        )}
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
        dark={isMapTab && isNightMap}
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
