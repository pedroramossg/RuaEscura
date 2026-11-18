import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Compass, MapPin, ShieldCheck } from 'lucide-react';
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

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Welcome-back screen inspired by Reference Image 2 (beaefa67):
 * Radiant sky-blue fan rays fading into crisp white, minimal top corner actions,
 * generous breathing room around the greeting, and 3 oversized expressive droplets
 * rising softly from the bottom edge.
 */
export const WelcomeBackOverlay: React.FC<WelcomeBackOverlayProps> = ({
  userName,
  timeSlot,
  safeRoutesCount = 5,
  onContinue,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hint, setHint] = useState<string>('COMO ESTÁ SEU TRAJETO HOJE?');
  const firstName = userName?.trim().split(/\s+/)[0] || 'Estudante';
  const greeting = getTimeGreeting();

  const enter = (delay: number, y = 12) =>
    prefersReducedMotion
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y, filter: 'blur(4px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 0.38, delay, ease: EASE_OUT },
        };

  return (
    <motion.div
      data-testid="welcome-back-screen"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="min-h-[100dvh] w-full flex flex-col justify-between bg-white text-[#111827] relative overflow-hidden select-none"
    >
      {/* Top Radial Sky-Blue Light Rays (Reference beaefa67) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%] overflow-hidden"
      >
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[150%] h-[420px] opacity-80"
          style={{
            background:
              'repeating-conic-gradient(from 150deg at 50% 0%, rgba(186,222,255,0.55) 0deg 8deg, rgba(224,242,254,0.22) 8deg 18deg)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
          }}
        />
      </div>

      {/* Minimal Top Bar */}
      <header className="relative z-10 px-5 pt-6 flex items-center justify-between max-w-lg w-full mx-auto">
        <button
          type="button"
          onClick={() => onContinue('explorar')}
          aria-label="Ir para explorar campus"
          className="w-11 h-11 rounded-2xl bg-white/75 backdrop-blur-md border border-white/90 text-[#2563EB] flex items-center justify-center shadow-xs hover:bg-white enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
        >
          <Compass className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-white/90 text-xs font-medium text-[#1E3A8A] shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
          <span>RuaEscura • {timeSlot}</span>
        </div>

        <button
          type="button"
          onClick={() => onContinue('mapa')}
          aria-label="Abrir mapa direto"
          className="w-11 h-11 rounded-2xl bg-white/75 backdrop-blur-md border border-white/90 text-[#111827] flex items-center justify-center shadow-xs hover:bg-white enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
        >
          <MapPin className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      {/* Generous Center Space + Greeting + Single Clean CTA */}
      <main className="relative z-10 px-6 mt-auto mb-4 flex flex-col items-center text-center max-w-md mx-auto space-y-4">
        <motion.div {...enter(0.06, 14)} className="space-y-1.5">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#111827]">
            {greeting}, {firstName}
          </h1>
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.14em] text-[#6B7280]">
            {hint}
          </p>
        </motion.div>

        <motion.div {...enter(0.16, 10)} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onContinue('explorar')}
            className="min-h-[48px] px-7 rounded-full bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium inline-flex items-center gap-2 shadow-md enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
          >
            <span>Entrar no campus</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onContinue('mapa')}
            className="min-h-[48px] px-5 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] text-sm font-medium enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
          >
            Mapa ({safeRoutesCount})
          </button>
        </motion.div>
      </main>

      {/* Bottom Oversized Soft Droplet Trio Emerging from Lower Edge (Reference beaefa67) */}
      <div
        aria-label="Mascotes interativos de boas-vindas"
        className="relative z-10 h-44 sm:h-52 w-full max-w-md mx-auto flex items-end justify-between pointer-events-auto overflow-hidden"
      >
        <motion.div
          initial={prefersReducedMotion ? false : { y: 42, opacity: 0 }}
          animate={{ y: 26, opacity: 1 }}
          transition={
            prefersReducedMotion ? { duration: 0.01 } : { type: 'spring', duration: 0.55, bounce: 0 }
          }
          className="-ml-6 shrink-0"
        >
          <DropletMascot
            state="idle"
            shape="galet"
            expression="curieux"
            size={156}
            inkColor="#6CC8FA"
            paperColor="#111827"
            notifColor="#FFFFFF"
            interactive
            onTap={() => setHint('OLHO ATENTO NOS POSTES DA TRINDADE!')}
            ariaLabel="Gotinha azul observadora"
          />
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { y: 54, opacity: 0 }}
          animate={{ y: 30, opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: 'spring', duration: 0.55, delay: 0.08, bounce: 0 }
          }
          className="z-10 shrink-0 -mx-6"
        >
          <DropletMascot
            state="idle"
            shape="goutte"
            expression="heureux"
            size={184}
            inkColor="#FAD86B"
            paperColor="#111827"
            notifColor="#10B981"
            interactive
            onTap={() => onContinue('explorar')}
            ariaLabel="Gotinha solar principal — toque para entrar"
          />
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { y: 42, opacity: 0 }}
          animate={{ y: 26, opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: 'spring', duration: 0.55, delay: 0.14, bounce: 0 }
          }
          className="-mr-6 shrink-0"
        >
          <DropletMascot
            state="idle"
            shape="galet"
            expression="surpris"
            size={156}
            inkColor="#F586BD"
            paperColor="#111827"
            notifColor="#FAD86B"
            interactive
            onTap={() => setHint('COLEGAS VERIFICADOS VIA GOV.BR!')}
            ariaLabel="Gotinha rosa animada"
          />
        </motion.div>
      </div>
    </motion.div>
  );
};
