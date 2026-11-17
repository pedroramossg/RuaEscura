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
  } = useCampusStore();

  const haptics = useHaptics();
  const [activeTab, setActiveTab] = useState<TabId>('explorar');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
      <main className="min-h-screen bg-[#FEF1CF] text-[#0B1226]">
        <Suspense fallback={<TabSkeleton label="Carregando boas-vindas..." />}>
          <OnboardingFlow onComplete={() => notify('Bem-vindo ao RuaEscura UFSC Trindade.')} />
        </Suspense>
      </main>
    );
  }

  const isMapTab = activeTab === 'mapa';

  return (
    <div
      className={`min-h-screen relative transition-colors duration-200 ${
        isMapTab && isNightMap
          ? 'bg-[#080E21] text-[#FEF1CF]'
          : 'bg-[#FEF1CF] text-[#0B1226]'
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
            className="max-w-md w-fit px-4 py-2.5 rounded-full bg-[#0131CD] text-[#B9FC01] text-xs sm:text-sm font-medium shadow-lg border border-[#B9FC01]/35"
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
            initial={prefersReducedMotion ? false : { opacity: 0, y: isMapTab ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { duration: 0.18, ease: 'easeOut' }
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
