import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CampusStoreProvider, useCampusStore } from './hooks/useCampusStore';
import { useHaptics } from './hooks/useHaptics';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { FloatingTabBar, TabId } from './components/ui/FloatingTabBar';
import { ExploreTab } from './components/explore/ExploreTab';
import { MapTab } from './components/map/MapTab';
import { LightsTab } from './components/lights/LightsTab';
import { ReportsTab } from './components/reports/ReportsTab';
import { ProfileSheet } from './components/profile/ProfileSheet';
import type { PersistedCampusState } from './types/campus';

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

  useEffect(() => {
    return () => {
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
      <main className="min-h-screen bg-[#f3f3f4] text-[#131314]">
        <OnboardingFlow onComplete={() => notify('Bem-vindo ao RuaEscura UFSC Trindade.')} />
      </main>
    );
  }

  const isMapTab = activeTab === 'mapa';

  return (
    <div
      className={`min-h-screen relative ${
        isMapTab && isNightMap
          ? 'bg-[#131314] text-[#f3f3f4]'
          : 'bg-[#f3f3f4] text-[#131314]'
      }`}
    >
      {/* Global Polite Toast Announcer */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 inset-x-4 z-[55] pointer-events-none flex justify-center"
      >
        {toastMessage && (
          <div
            role="status"
            className="max-w-md w-fit px-4 py-2.5 rounded-full bg-[#131314] text-[#befc65] text-xs sm:text-sm font-medium shadow-lg border border-white/15"
          >
            {toastMessage}
          </div>
        )}
      </div>

      {/* Active Tab Content (MapTab is unmounted on other tabs to preserve single-sheet rule) */}
      <main>
        {activeTab === 'explorar' && (
          <ExploreTab
            onOpenMap={() => handleTabChange('mapa')}
            onOpenLights={() => handleTabChange('postes')}
            onOpenReports={() => handleTabChange('denuncias')}
            onOpenProfile={() => setIsProfileOpen(true)}
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
      </main>

      {/* Single-Sheet Profile Drawer (only rendered when opened outside MapTab) */}
      <ProfileSheet
        isOpen={isProfileOpen && !isMapTab}
        onClose={() => setIsProfileOpen(false)}
        onNotify={notify}
      />

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
