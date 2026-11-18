import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Clock, Footprints, Info, ShieldAlert, Users } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

// Dot matrix patterns for characters & digits (5x7 grid) adapted for light mode
const DOT_MATRIX: Record<string, number[][]> = {
  A: [
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  B: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  C: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  D: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  E: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  F: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
  ],
  G: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  H: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  I: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  J: [
    [0, 0, 1, 1, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 1, 0],
    [0, 1, 1, 0, 0],
  ],
  K: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 0, 0, 0],
    [1, 0, 1, 0, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  L: [
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  M: [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  N: [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  O: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  P: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
  ],
  Q: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 1, 0, 1],
  ],
  R: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  S: [
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  T: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  U: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  V: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
  ],
  W: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 0, 1, 1],
    [1, 0, 0, 0, 1],
  ],
  X: [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  Y: [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  Z: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
};

function toDotCode(shortName: string): string {
  const letters = shortName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  return (letters.slice(0, 3) || 'UFS').trim();
}

function DotMatrixChar({
  char,
  dotSize = 4,
  gap = 2,
  activeColor,
  inactiveColor,
  delay = 0,
  reducedMotion,
}: {
  char: string;
  dotSize?: number;
  gap?: number;
  activeColor: string;
  inactiveColor: string;
  delay?: number;
  reducedMotion: boolean;
}) {
  const matrix = DOT_MATRIX[char.toUpperCase()] ?? DOT_MATRIX['U']!;
  const width = 5 * dotSize + 4 * gap;
  const height = 7 * dotSize + 6 * gap;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {matrix.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <motion.rect
            key={`${rowIndex}-${colIndex}`}
            x={colIndex * (dotSize + gap)}
            y={rowIndex * (dotSize + gap)}
            width={dotSize}
            height={dotSize}
            rx={dotSize / 2}
            ry={dotSize / 2}
            fill={cell ? activeColor : inactiveColor}
            initial={reducedMotion ? false : { opacity: 0.25 }}
            animate={{ opacity: 1 }}
            transition={
              reducedMotion
                ? { duration: 0.01 }
                : { delay: delay + colIndex * 0.025 + rowIndex * 0.02, duration: 0.16 }
            }
          />
        ))
      )}
    </svg>
  );
}

function DotMatrixText({
  text,
  activeColor,
  inactiveColor,
  reducedMotion,
}: {
  text: string;
  activeColor: string;
  inactiveColor: string;
  reducedMotion: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-label={text}>
      {text.split('').map((char, index) => (
        <DotMatrixChar
          key={`${text}-${index}`}
          char={char}
          dotSize={4}
          gap={1.5}
          activeColor={activeColor}
          inactiveColor={inactiveColor}
          delay={index * 0.06}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
}

function HalftoneLightPattern() {
  return (
    <svg
      className="absolute inset-0 pointer-events-none opacity-45"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="halftone-light-route"
          x="0"
          y="0"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1.15" fill="rgba(37, 99, 235, 0.14)" />
        </pattern>
        <linearGradient id="halftone-fade-route" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="55%" stopColor="white" stopOpacity="0.45" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="halftone-mask-route">
          <rect width="100%" height="100%" fill="url(#halftone-fade-route)" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="url(#halftone-light-route)"
        mask="url(#halftone-mask-route)"
      />
    </svg>
  );
}

export interface RouteStatusCardProps {
  originShort: string;
  destShort: string;
  originName: string;
  destName: string;
  estimatedMinutes: number;
  distanceMeters: number;
  litPostsCount: number;
  totalPostsCount: number;
  companionsCount: number;
  hasDarkWarning: boolean;
  progress: number;
  scheduledTime?: string;
  timeSlot: string;
  onSwapRoute: () => void;
  onOpenSchedule: () => void;
  onOpenDetails: () => void;
  className?: string;
}

/**
 * Light-mode adaptation of Componentry's FlightStatusCard tuned for UFSC safe walking corridors.
 * Displays dot-matrix campus hub codes, ETA & scheduled departure, active lamp track, and sheet triggers.
 */
export const RouteStatusCard: React.FC<RouteStatusCardProps> = ({
  originShort,
  destShort,
  originName,
  destName,
  estimatedMinutes,
  distanceMeters,
  litPostsCount,
  totalPostsCount,
  companionsCount,
  hasDarkWarning,
  progress,
  scheduledTime,
  timeSlot,
  onSwapRoute,
  onOpenSchedule,
  onOpenDetails,
  className = '',
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const depCode = toDotCode(originShort);
  const arrCode = toDotCode(destShort);

  const activeColor = hasDarkWarning ? '#D97706' : '#1D4ED8';
  const inactiveColor = hasDarkWarning
    ? 'rgba(217, 119, 6, 0.16)'
    : 'rgba(37, 99, 235, 0.14)';

  // Compute simulated departure and arrival clock display
  const baseHHMM = scheduledTime ?? '21:15';
  const [hhStr, mmStr] = baseHHMM.split(':');
  const startTotal = (Number(hhStr) || 21) * 60 + (Number(mmStr) || 0);
  const etaTotal = (startTotal + Math.max(1, estimatedMinutes)) % 1440;
  const etaClock = `${String(Math.floor(etaTotal / 60)).padStart(2, '0')}:${String(
    etaTotal % 60
  ).padStart(2, '0')}`;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={
        prefersReducedMotion
          ? { duration: 0.01 }
          : { duration: 0.36, ease: [0.23, 1, 0.32, 1] }
      }
      className={`relative w-full rounded-[28px] bg-white p-5 sm:p-6 overflow-hidden border border-[#D5E0EE] shadow-[0_4px_16px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] ${className}`.trim()}
    >
      <HalftoneLightPattern />

      <div className="relative z-10 space-y-5">
        {/* Top Row: Dot-Matrix Campus Hubs + ETA/Status Panel */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* Origin Hub */}
            <div className="flex flex-col items-start min-w-0">
              <DotMatrixText
                text={depCode}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                reducedMotion={prefersReducedMotion}
              />
              <span className="text-[#111827] text-xs font-semibold mt-2 truncate max-w-[116px]">
                {originShort}
              </span>
              <span className="text-[#4B5563] text-[11px] truncate max-w-[116px]">
                {originName}
              </span>
              <span className="text-[#64748B] text-[10px] font-medium mt-0.5 uppercase tracking-wide">
                {scheduledTime ? `SAÍDA ${scheduledTime}` : `JANELA ${timeSlot}`}
              </span>
            </div>

            {/* Direction Arrow */}
            <div className="flex items-center px-1 pt-2.5 shrink-0">
              <motion.svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className={hasDarkWarning ? 'text-[#D97706]' : 'text-[#2563EB]'}
                initial={prefersReducedMotion ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                aria-hidden="true"
              >
                <path
                  d="M5 12h14m0 0l-4-4m4 4l-4 4"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </div>

            {/* Destination Hub */}
            <div className="flex flex-col items-start min-w-0">
              <DotMatrixText
                text={arrCode}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                reducedMotion={prefersReducedMotion}
              />
              <span className="text-[#111827] text-xs font-semibold mt-2 truncate max-w-[116px]">
                {destShort}
              </span>
              <span className="text-[#4B5563] text-[11px] truncate max-w-[116px]">
                {destName}
              </span>
              <span className="text-[#64748B] text-[10px] font-medium mt-0.5 uppercase tracking-wide">
                CHEGADA ~{etaClock}
              </span>
            </div>
          </div>

          {/* Light ETA & Swap Panel */}
          <div className="flex sm:flex-col items-center sm:items-stretch justify-between bg-[#E5EDF7]/70 rounded-2xl p-3 sm:min-w-[148px] border border-[#D5E0EE] gap-2">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#0F172A] text-sm font-semibold tabular-nums">
                  {scheduledTime ? `Saída ${scheduledTime}` : `ETA ${etaClock}`}
                </span>
                <button
                  type="button"
                  onClick={onSwapRoute}
                  aria-label="Inverter origem e destino"
                  className="min-w-[34px] min-h-[34px] -my-1 -mr-1 inline-flex items-center justify-center rounded-full bg-white/80 hover:bg-white border border-[#D5E0EE] enabled:active:scale-[0.94] text-[#475569] transition-[transform,background-color] duration-150 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-[#475569] text-[11px] mt-0.5">
                {hasDarkWarning ? 'Trecho com alerta' : 'Corredor iluminado'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {hasDarkWarning ? (
                <span className="inline-flex items-center gap-1 text-[#B45309]">
                  <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{litPostsCount}/{totalPostsCount} postes</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#059669]">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{companionsCount} colegas na rota</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Light Progress Track (Componentry flight-progress geometry) */}
        <div className="space-y-1.5">
          <div className="relative h-12 bg-[#E5EDF7] rounded-full overflow-hidden border border-[#D5E0EE] flex items-center pr-1.5">
            <motion.div
              className="h-full rounded-full flex items-center justify-end pr-2 shrink-0"
              initial={prefersReducedMotion ? false : { width: '18%' }}
              animate={{ width: `${Math.max(Math.min(progress * 0.68, 68), 22)}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : { duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.12 }
              }
              style={{
                background: hasDarkWarning
                  ? 'linear-gradient(90deg, #D97706 0%, #F59E0B 60%, #FBBF24 100%)'
                  : 'linear-gradient(90deg, #1D4ED8 0%, #2563EB 55%, #10B981 100%)',
                boxShadow: hasDarkWarning
                  ? '0 0 14px rgba(245, 158, 11, 0.35), inset 0 1px 2px rgba(255,255,255,0.35)'
                  : '0 0 14px rgba(37, 99, 235, 0.3), inset 0 1px 2px rgba(255,255,255,0.35)',
              }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full text-white"
                style={{ background: 'rgba(255, 255, 255, 0.24)' }}
              >
                <Footprints className="w-4 h-4" aria-hidden="true" />
              </div>
            </motion.div>

            <div className="ml-auto text-[#0F172A] bg-white px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums border border-[#D5E0EE] shadow-2xs shrink-0">
              ~{estimatedMinutes} min • {distanceMeters} m
            </div>
          </div>

          {/* Action triggers: Schedule Departure + Route Details (Apple HIG secondary actions) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
            <button
              type="button"
              onClick={onOpenSchedule}
              className="min-h-[44px] px-3.5 rounded-full bg-[#E5EDF7]/75 hover:bg-[#DCE6F4] border border-[#D5E0EE] enabled:active:scale-[0.96] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5 transition-[transform,background-color] duration-150 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>
                {scheduledTime ? `Horário marcado: ${scheduledTime}` : 'Marcar horário para sair'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenDetails}
              className="min-h-[44px] px-3.5 rounded-full bg-white hover:bg-[#E5EDF7]/70 border border-[#D5E0EE] enabled:active:scale-[0.96] text-xs font-medium text-[#334155] inline-flex items-center gap-1.5 transition-[transform,background-color] duration-150 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-[#475569]" aria-hidden="true" />
              <span>Detalhes da rota</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

