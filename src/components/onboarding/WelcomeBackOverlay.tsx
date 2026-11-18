import React, { useId, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import ufscLogo from '../../assets/ufsc-logo.webp';
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
const SPRING_SETTLE = { type: 'spring', duration: 0.65, bounce: 0 } as const;
const GAZE_SPRING = { stiffness: 140, damping: 24, mass: 0.6 } as const;

/**
 * Welcome-back screen matched to Reference Image 2:
 * Radiant top sky sunburst fading into pure white, minimal frosted corner actions,
 * calligraphic double-loop emblem, generous breathing room above a lower-third greeting,
 * and three soft-diffused pastel mascots emerging organically from the screen edges.
 */
export const WelcomeBackOverlay: React.FC<WelcomeBackOverlayProps> = ({
  userName,
  timeSlot,
  safeRoutesCount = 5,
  onContinue,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hint, setHint] = useState<string>('COMO ESTÁ SEU TRAJETO HOJE?');
  const uid = useId().replace(/:/g, '');

  const firstName = userName?.trim().split(/\s+/)[0] || 'Estudante';
  const greeting = getTimeGreeting();

  // Subtle pointer parallax & gaze shift (non-touch only, disabled under reduced motion)
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, GAZE_SPRING);
  const smoothY = useSpring(pointerY, GAZE_SPRING);

  const gazeX = useTransform(smoothX, [-1, 1], [-5, 5]);
  const gazeY = useTransform(smoothY, [-1, 1], [-3.5, 3.5]);
  const bodyShiftX = useTransform(smoothX, [-1, 1], [-2.5, 2.5]);
  const bodyShiftY = useTransform(smoothY, [-1, 1], [-2, 2]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerX.set(Math.max(-1, Math.min(1, nx)));
    pointerY.set(Math.max(-1, Math.min(1, ny)));
  };

  const handlePointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const enterText = (delay: number, y = 12) =>
    prefersReducedMotion
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
        initial: { opacity: 0, y, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.4, delay, ease: EASE_OUT },
      };

  const floatLoop = (duration: number, delay = 0) =>
    prefersReducedMotion
      ? undefined
      : {
        y: [0, -5, 0],
        scale: [1, 1.015, 1],
        transition: {
          duration,
          delay,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      };

  return (
    <motion.div
      data-testid="welcome-back-screen"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="min-h-[100dvh] w-full flex flex-col justify-between bg-white text-[#454954] relative overflow-hidden select-none"
    >
      {/* Top Radiant Sky Sunburst Stage (~45% height fading seamlessly into pure white) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[46%] overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, #CDE7FF 0%, #E8F4FF 56%, #FFFFFF 100%)',
        }}
      >
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 w-[170%] h-full opacity-90"
          style={{
            background:
              'repeating-conic-gradient(from 138deg at 50% 0%, rgba(255,255,255,0.44) 0deg 8deg, rgba(168,214,255,0.20) 8deg 19deg)',
            maskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
          }}
        />
      </div>

      {/* Minimal Header Row */}
      <header className="relative z-20 px-5 pt-6 flex items-center justify-between max-w-lg w-full mx-auto">
        <button
          type="button"
          onClick={() => onContinue('explorar')}
          aria-label="Ir para explorar campus"
          className="w-11 h-11 rounded-[14px] border border-white/80 bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E293B]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3.2c1.45 0 2.35 1.85 1.95 3.35 1.5-.4 3.3.5 3.75 1.88.44 1.38-.68 2.95-2.18 3.25.95 1.18.88 3.1-.38 4.02-1.26.92-3.05.3-3.64-1.08-.59 1.38-2.38 2-3.64 1.08-1.26-.92-1.33-2.84-.38-4.02-1.5-.3-2.62-1.87-2.18-3.25.45-1.38 2.25-2.28 3.75-1.88C9.65 5.05 10.55 3.2 12 3.2Z" />
            <circle cx="12" cy="11.2" r="1.45" />
          </svg>
        </button>

        <div
          role="img"
          aria-label={`UFSC • RuaEscura • Turno ${timeSlot}`}
          title={`UFSC • RuaEscura • ${timeSlot}`}
          className="flex items-center justify-center px-2 py-1"
        >
          <img
            src={ufscLogo}
            alt=""
            width={119}
            height={160}
            decoding="async"
            className="h-11 sm:h-12 w-auto object-contain select-none pointer-events-none"
          />
        </div>

        <button
          type="button"
          onClick={() => onContinue('mapa')}
          aria-label={`Abrir mapa (${safeRoutesCount} postes ativos)`}
          className="w-11 h-11 rounded-[14px] border border-white/80 bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E293B]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="7" y1="9.5" x2="17" y2="9.5" />
            <line x1="7" y1="14.5" x2="17" y2="14.5" />
          </svg>
        </button>
      </header>


      {/* Lower-Third Greeting & Single Sleek CTA */}
      <main className="relative z-20 px-6 pb-2 flex flex-col items-center text-center max-w-md mx-auto w-full mt-30">
        <motion.div {...enterText(0.05, 14)} className="space-y-1.5">
          <h1 className="text-[40px] sm:text-[46px] font-semibold tracking-[-0.03em] leading-[1.06] text-[#454954]">
            {greeting}, {firstName}
          </h1>
          <p
            aria-live="polite"
            className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.06em] text-[#8E95A2]"
          >
            {hint}
          </p>
        </motion.div>

        <motion.div {...enterText(0.14, 10)} className="mt-5">
          <button
            type="button"
            onClick={() => onContinue('explorar')}
            className="min-h-[46px] px-7 rounded-full bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium inline-flex items-center gap-2 shadow-md enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]"
          >
            <span>Entrar no campus</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </motion.div>
      </main>

      {/* 3 Soft-Diffused Ambient Mascots Emerging from Edges */}
      <div
        aria-label="Mascotes interativos de boas-vindas"
        className="relative z-10 h-44 sm:h-52 w-full max-w-lg mx-auto pointer-events-none"
      >
        {/* Left Blue Character (#5EC2F3 -> #87D7FA) */}
        <motion.button
          type="button"
          onClick={() => setHint(`${safeRoutesCount} POSTES ACESOS AGORA NA TRINDADE`)}
          aria-label="Gotinha azul observadora — ver postes acesos"
          initial={prefersReducedMotion ? false : { x: -36, y: 18, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0.01 } : SPRING_SETTLE}
          className="pointer-events-auto absolute -left-24 sm:-left-16 bottom-6 w-[210px] h-[240px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EC2F3] rounded-full"
        >
          <motion.div
            style={prefersReducedMotion ? undefined : { x: bodyShiftX, y: bodyShiftY }}
            className="w-full h-full"
          >
            <motion.div animate={floatLoop(4.2, 0)} className="relative w-full h-full">
              <div
                aria-hidden="true"
                className="absolute inset-1 rounded-full opacity-55 blur-xl"
                style={{
                  background: 'radial-gradient(circle at 55% 45%, #87D7FA 0%, #5EC2F3 58%, transparent 78%)',
                }}
              />
              <svg viewBox="0 0 220 250" className="relative w-full h-full overflow-visible" aria-hidden="true">
                <defs>
                  <linearGradient id={`${uid}-blue-grad`} x1="0%" y1="0%" x2="85%" y2="95%">
                    <stop offset="0%" stopColor="#87D7FA" />
                    <stop offset="100%" stopColor="#5EC2F3" />
                  </linearGradient>
                  <filter id={`${uid}-blue-blur`} x="-15%" y="-15%" width="130%" height="130%">
                    <feGaussianBlur stdDeviation="6.5" />
                  </filter>
                </defs>

                <ellipse
                  cx="104"
                  cy="126"
                  rx="88"
                  ry="108"
                  fill={`url(#${uid}-blue-grad)`}
                  filter={`url(#${uid}-blue-blur)`}
                />

                {/* Crisp dark slanted teardrop eyes with 4-point white star sparkles */}
                <motion.g style={prefersReducedMotion ? undefined : { x: gazeX, y: gazeY }}>
                  {/* Subtle freckles */}
                  <circle cx="122" cy="144" r="2.1" fill="#3299D4" opacity="0.35" />
                  <circle cx="134" cy="152" r="1.7" fill="#3299D4" opacity="0.3" />
                  <circle cx="114" cy="150" r="1.6" fill="#3299D4" opacity="0.28" />

                  {/* Upper-left eye */}
                  <path
                    d="M112 82 C124 72 142 76 146 90 C148 99 136 106 124 101 C113 97 107 88 112 82 Z"
                    fill="#0F172A"
                  />
                  {/* Lower-right eye */}
                  <path
                    d="M144 112 C158 106 172 116 170 132 C168 144 154 149 145 141 C136 133 136 117 144 112 Z"
                    fill="#0F172A"
                  />
                  {/* 4-point star sparkles */}
                  <path
                    d="M138 76 L140.1 82.4 L146.5 84.5 L140.1 86.6 L138 93 L135.9 86.6 L129.5 84.5 L135.9 82.4 Z"
                    fill="#FFFFFF"
                  />
                  <path
                    d="M163 113 L164.9 118.6 L170.5 120.5 L164.9 122.4 L163 128 L161.1 122.4 L155.5 120.5 L161.1 118.6 Z"
                    fill="#FFFFFF"
                  />
                </motion.g>
              </svg>
            </motion.div>
          </motion.div>
        </motion.button>

        {/* Center Warm Yellow-Gold Dome (#FFE270 -> #F7C648) */}
        <motion.button
          type="button"
          onClick={() => onContinue('explorar')}
          aria-label="Gotinha solar principal — toque para entrar"
          initial={prefersReducedMotion ? false : { y: 44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={
            prefersReducedMotion ? { duration: 0.01 } : { ...SPRING_SETTLE, delay: 0.08 }
          }
          className="pointer-events-auto absolute left-1/2 -translate-x-1/2 -bottom-10 w-[264px] sm:w-[290px] h-[176px] sm:h-[188px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F7C648] rounded-full z-10"
        >
          <motion.div
            style={prefersReducedMotion ? undefined : { x: bodyShiftX, y: bodyShiftY }}
            className="w-full h-full"
          >
            <motion.div animate={floatLoop(4.8, 0.4)} className="relative w-full h-full">
              <div
                aria-hidden="true"
                className="absolute inset-x-2 -top-2 bottom-0 rounded-full opacity-55 blur-xl"
                style={{
                  background: 'radial-gradient(ellipse at 50% 48%, #FFE270 0%, #F7C648 56%, transparent 78%)',
                }}
              />
              <svg viewBox="0 0 280 190" className="relative w-full h-full overflow-visible" aria-hidden="true">
                <defs>
                  <radialGradient id={`${uid}-gold-grad`} cx="50%" cy="46%" r="58%">
                    <stop offset="0%" stopColor="#FFE270" />
                    <stop offset="72%" stopColor="#FAD158" />
                    <stop offset="100%" stopColor="#F7C648" />
                  </radialGradient>
                  <filter id={`${uid}-gold-blur`} x="-15%" y="-15%" width="130%" height="130%">
                    <feGaussianBlur stdDeviation="7" />
                  </filter>
                </defs>

                <ellipse
                  cx="140"
                  cy="126"
                  rx="124"
                  ry="104"
                  fill={`url(#${uid}-gold-grad)`}
                  filter={`url(#${uid}-gold-blur)`}
                />

                {/* Sharp joyful closed-arch eyes and wide smiling mouth */}
                <motion.g style={prefersReducedMotion ? undefined : { x: gazeX, y: gazeY }}>
                  <path
                    d="M102 68 C104 51 130 51 132 68 C124 65.5 110 65.5 102 68 Z"
                    fill="#0F172A"
                  />
                  <path
                    d="M148 68 C150 51 176 51 178 68 C170 65.5 156 65.5 148 68 Z"
                    fill="#0F172A"
                  />
                  <path
                    d="M102 90 C121 107 159 107 178 90"
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                  />
                </motion.g>
              </svg>
            </motion.div>
          </motion.div>
        </motion.button>

        {/* Right Soft Pink Character (#EE86BF -> #F5A4CE) */}
        <motion.button
          type="button"
          onClick={() => setHint('COLEGAS VERIFICADOS GOV.BR NO SEU HORÁRIO')}
          aria-label="Gotinha rosa animada — colegas verificados"
          initial={prefersReducedMotion ? false : { x: 36, y: 18, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          transition={
            prefersReducedMotion ? { duration: 0.01 } : { ...SPRING_SETTLE, delay: 0.12 }
          }
          className="pointer-events-auto absolute -right-24 sm:-right-16 bottom-8 w-[210px] h-[240px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EE86BF] rounded-full"
        >
          <motion.div
            style={prefersReducedMotion ? undefined : { x: bodyShiftX, y: bodyShiftY }}
            className="w-full h-full"
          >
            <motion.div animate={floatLoop(4.5, 0.25)} className="relative w-full h-full">
              <div
                aria-hidden="true"
                className="absolute inset-1 rounded-full opacity-55 blur-xl"
                style={{
                  background: 'radial-gradient(circle at 45% 45%, #F5A4CE 0%, #EE86BF 58%, transparent 78%)',
                }}
              />
              <svg viewBox="0 0 220 250" className="relative w-full h-full overflow-visible" aria-hidden="true">
                <defs>
                  <linearGradient id={`${uid}-pink-grad`} x1="100%" y1="0%" x2="15%" y2="95%">
                    <stop offset="0%" stopColor="#F5A4CE" />
                    <stop offset="100%" stopColor="#EE86BF" />
                  </linearGradient>
                  <filter id={`${uid}-pink-blur`} x="-15%" y="-15%" width="130%" height="130%">
                    <feGaussianBlur stdDeviation="6.5" />
                  </filter>
                </defs>

                <ellipse
                  cx="124"
                  cy="126"
                  rx="88"
                  ry="108"
                  fill={`url(#${uid}-pink-grad)`}
                  filter={`url(#${uid}-pink-blur)`}
                />

                {/* Sharp dark curved cheerful eyes tilted warmly toward center */}
                <motion.g style={prefersReducedMotion ? undefined : { x: gazeX, y: gazeY }}>
                  <path
                    d="M96 86 C80 86 73 102 82 110 C87 114 93 107 98 102 C104 96 105 86 96 86 Z"
                    fill="#0F172A"
                  />
                  <path
                    d="M72 118 C57 119 52 135 61 144 C67 150 75 144 78 136 C81 128 80 118 72 118 Z"
                    fill="#0F172A"
                  />
                </motion.g>
              </svg>
            </motion.div>
          </motion.div>
        </motion.button>
      </div>
    </motion.div>
  );
};
