import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { DropletMascot } from '../mascot/DropletMascot';
import type { TabId } from '../ui/FloatingTabBar';

export interface WelcomeBackOverlayProps {
  userName?: string | null;
  timeSlot: string;
  safeRoutesCount?: number;
  onContinue: (targetTab?: TabId) => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const MOOD_PROMPTS = [
  { id: 'safe', label: 'Quero rota iluminada', tab: 'mapa' as TabId, reply: 'Vamos pelo corredor mais claro!' },
  { id: 'peers', label: 'Ir com colegas', tab: 'mapa' as TabId, reply: 'Temos estudantes Gov.br indo agora!' },
  { id: 'qr', label: 'Reportar poste QR', tab: 'postes' as TabId, reply: 'Bora atualizar a rede do campus!' },
];

/**
 * Welcome-back atmospheric screen inspired by Reference Image 3:
 * Sky-blue top fade into pure white, clean editorial greeting,
 * quick mood/intent chips, and a trio of expressive interactive droplets at the bottom edge.
 */
export const WelcomeBackOverlay: React.FC<WelcomeBackOverlayProps> = ({
  userName,
  timeSlot,
  safeRoutesCount = 5,
  onContinue,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [selectedReply, setSelectedReply] = useState<string>(
    'Pronto para caminhar pela Trindade no claro?'
  );
  const firstName = userName?.trim().split(/\s+/)[0] || 'Estudante';
  const greeting = getTimeGreeting();

  return (
    <motion.div
      data-testid="welcome-back-screen"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[70] flex flex-col justify-between bg-gradient-to-b from-[#CBE2FF] via-[#EEF5FF] to-white text-[#111827] overflow-hidden select-none"
    >
      {/* Top Minimal Brand + Campus XP Pill */}
      <header className="px-5 pt-6 flex items-center justify-between max-w-xl w-full mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/90 text-xs font-medium text-[#1E3A8A] shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
          <span>RuaEscura • {timeSlot}</span>
        </span>

        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/90 text-xs font-semibold text-[#111827] shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
          <span>{safeRoutesCount * 20} XP</span>
        </span>
      </header>

      {/* Center Editorial Greeting & Quick Mood Intents */}
      <main className="px-6 flex flex-col items-center text-center max-w-md mx-auto space-y-5">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#111827]">
            {greeting}, {firstName}
          </h1>
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.14em] text-[#4B5563]">
            Como está seu trajeto hoje?
          </p>
        </div>

        <p className="text-sm text-[#2563EB] font-medium bg-[#EFF6FF] border border-[#DBEAFE] px-4 py-2 rounded-full">
          {selectedReply}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {MOOD_PROMPTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedReply(item.reply);
                onContinue(item.tab);
              }}
              className="min-h-[44px] px-4 rounded-full bg-white border border-[#E5EAF4] hover:border-[#2563EB] text-xs sm:text-sm font-medium text-[#111827] shadow-xs active:scale-[0.97] transition-all cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onContinue('explorar')}
          className="min-h-[48px] px-7 rounded-full bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium inline-flex items-center gap-2 shadow-md active:scale-[0.97] transition-all cursor-pointer"
        >
          <span>Entrar no campus</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </main>

      {/* Bottom Expressive Mascot Trio (Reference Image 3) */}
      <div
        aria-label="Mascotes interativos de boas-vindas"
        className="relative h-44 sm:h-52 w-full max-w-lg mx-auto flex items-end justify-between px-2 pointer-events-auto overflow-hidden"
      >
        <div className="-ml-6 translate-y-4">
          <DropletMascot
            state="comet"
            expression="curieux"
            size={132}
            inkColor="#38BDF8"
            paperColor="#0F172A"
            notifColor="#FFFFFF"
            interactive
            onTap={() => setSelectedReply('Olho atento nas vias da Trindade!')}
            ariaLabel="Gotinha azul observadora"
          />
        </div>

        <div className="translate-y-5 z-10">
          <DropletMascot
            state="play"
            expression="heureux"
            size={156}
            inkColor="#FBBF24"
            paperColor="#111827"
            notifColor="#10B981"
            interactive
            onTap={() => onContinue('explorar')}
            ariaLabel="Gotinha solar principal — toque para entrar"
          />
        </div>

        <div className="-mr-6 translate-y-4">
          <DropletMascot
            state="wink"
            expression="surpris"
            size={132}
            inkColor="#F472B6"
            paperColor="#111827"
            notifColor="#FBBF24"
            interactive
            onTap={() => setSelectedReply('Mais colegas conectados no Gov.br!')}
            ariaLabel="Gotinha rosa animada"
          />
        </div>
      </div>
    </motion.div>
  );
};
