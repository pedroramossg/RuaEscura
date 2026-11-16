import { useState } from 'react';
import { FloatingTabBar, TabId } from './components/ui/FloatingTabBar';
import { BottomSheet, SheetDetent } from './components/ui/BottomSheet';
import { PillButton } from './components/ui/PillButton';
import { useHaptics } from './hooks/useHaptics';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('mapa');
  const [detent, setDetent] = useState<SheetDetent>('peek');
  const [nightMode, setNightMode] = useState(false);
  const { trigger } = useHaptics();

  const handleTabChange = (tab: TabId) => {
    trigger('selection');
    setActiveTab(tab);
  };

  return (
    <div className={`min-h-screen relative overflow-hidden ${nightMode ? 'bg-[#131314] text-[#f3f3f4]' : 'bg-[#f3f3f4] text-[#131314]'}`}>
      {/* Top Header */}
      <header className="p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">RuaEscura</h1>
          <p className="text-xs text-[#66646d]">UFSC Campus Trindade</p>
        </div>
        <PillButton
          variant={nightMode ? 'lime' : 'ink'}
          size="compact"
          onClick={() => {
            trigger('medium');
            setNightMode((prev) => !prev);
          }}
        >
          {nightMode ? '☀ Modo Claro' : '☾ Luz Noturna'}
        </PillButton>
      </header>

      {/* Main Content Area */}
      <main className="p-4 pb-48">
        <div className="rounded-[24px] bg-white dark:bg-[#1c1c1e] p-6 shadow-sm border border-[#dfe3e6]">
          <h2 className="text-lg font-semibold mb-2">Aba Ativa: {activeTab}</h2>
          <p className="text-sm text-[#46444a] mb-4">
            Infraestrutura de iluminação, rotas seguras e canal comunitário para o Campus Trindade.
          </p>
          <div className="flex flex-wrap gap-2">
            <PillButton variant="lime" onClick={() => trigger('success')}>
              Ação Lima
            </PillButton>
            <PillButton variant="outline" onClick={() => trigger('light')}>
              Ação Outline
            </PillButton>
            <PillButton variant="danger" onClick={() => trigger('warning')}>
              Emergência
            </PillButton>
          </div>
        </div>
      </main>

      {/* Bottom Sheet */}
      <BottomSheet
        detent={detent}
        onDetentChange={(d) => {
          trigger('selection');
          setDetent(d);
        }}
        dark={nightMode}
      >
        <div className="space-y-2">
          <h3 className="font-semibold text-base">Painel de Navegação do Campus</h3>
          <p className="text-sm opacity-80">
            Arraste ou clique na barra superior para alternar entre os estados do painel.
          </p>
        </div>
      </BottomSheet>

      {/* Floating Tab Bar */}
      <FloatingTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        dark={nightMode}
        alertCount={2}
      />
    </div>
  );
}

export default App;
