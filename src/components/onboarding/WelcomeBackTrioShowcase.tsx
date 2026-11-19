import React, { useId } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const SPRING_SETTLE = { type: 'spring', duration: 0.65, bounce: 0 } as const;
const GAZE_SPRING = { stiffness: 140, damping: 24, mass: 0.6 } as const;

export interface WelcomeBackGaze {
  gazeX: MotionValue<number>;
  gazeY: MotionValue<number>;
  bodyShiftX: MotionValue<number>;
  bodyShiftY: MotionValue<number>;
  handlePointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  handlePointerLeave: () => void;
}

/**
 * Shared pointer-parallax & gaze spring hook (zero React setState per frame).
 */
export function useWelcomeBackGaze(prefersReducedMotion: boolean): WelcomeBackGaze {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, GAZE_SPRING);
  const smoothY = useSpring(pointerY, GAZE_SPRING);

  const gazeX = useTransform(smoothX, [-1, 1], [-5, 5]);
  const gazeY = useTransform(smoothY, [-1, 1], [-3.5, 3.5]);
  const bodyShiftX = useTransform(smoothX, [-1, 1], [-2.5, 2.5]);
  const bodyShiftY = useTransform(smoothY, [-1, 1], [-2, 2]);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
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

  return {
    gazeX,
    gazeY,
    bodyShiftX,
    bodyShiftY,
    handlePointerMove,
    handlePointerLeave,
  };
}

export interface WelcomeBackTrioShowcaseProps {
  variant: 'edges' | 'centered';
  gaze?: WelcomeBackGaze;
  onBlueClick?: () => void;
  onGoldClick?: () => void;
  onPinkClick?: () => void;
  className?: string;
}

interface CharacterShellProps {
  id: 'blue' | 'gold' | 'pink';
  interactive: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  className: string;
  initial: Record<string, number> | false;
  transition: Record<string, unknown>;
  floatDuration: number;
  floatDelay: number;
  prefersReducedMotion: boolean;
  gaze?: WelcomeBackGaze;
  children: React.ReactNode;
}

const CharacterShell: React.FC<CharacterShellProps> = ({
  id,
  interactive,
  ariaLabel,
  onClick,
  className,
  initial,
  transition,
  floatDuration,
  floatDelay,
  prefersReducedMotion,
  gaze,
  children,
}) => {
  const floatAnimate = prefersReducedMotion
    ? undefined
    : {
        y: [0, -5, 0],
        scale: [1, 1.015, 1],
        transition: {
          duration: floatDuration,
          delay: floatDelay,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      };

  const inner = (
    <motion.div
      style={prefersReducedMotion || !gaze ? undefined : { x: gaze.bodyShiftX, y: gaze.bodyShiftY }}
      className="w-full h-full"
    >
      <motion.div animate={floatAnimate} className="relative w-full h-full">
        {children}
      </motion.div>
    </motion.div>
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        data-trio-member={id}
        onClick={onClick}
        aria-label={ariaLabel}
        initial={initial}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={transition}
        className={className}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <motion.div
      data-trio-member={id}
      initial={initial}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={transition}
      className={className}
    >
      {inner}
    </motion.div>
  );
};

interface MascotGraphicProps {
  uid: string;
  prefersReducedMotion: boolean;
  gaze?: WelcomeBackGaze;
}

const BlueMascotGraphic: React.FC<MascotGraphicProps> = ({ uid, prefersReducedMotion, gaze }) => (
  <>
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
      <motion.g style={prefersReducedMotion || !gaze ? undefined : { x: gaze.gazeX, y: gaze.gazeY }}>
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
  </>
);

const GoldMascotGraphic: React.FC<MascotGraphicProps> = ({ uid, prefersReducedMotion, gaze }) => (
  <>
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
      <motion.g style={prefersReducedMotion || !gaze ? undefined : { x: gaze.gazeX, y: gaze.gazeY }}>
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
  </>
);

const PinkMascotGraphic: React.FC<MascotGraphicProps> = ({ uid, prefersReducedMotion, gaze }) => (
  <>
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
      <motion.g style={prefersReducedMotion || !gaze ? undefined : { x: gaze.gazeX, y: gaze.gazeY }}>
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
  </>
);

/**
 * Shared WelcomeBack Trio showcase used identically by WelcomeBackOverlay (variant="edges")
 * and Onboarding Step 5 "Tudo pronto!" (variant="centered").
 */
export const WelcomeBackTrioShowcase: React.FC<WelcomeBackTrioShowcaseProps> = ({
  variant,
  gaze,
  onBlueClick,
  onGoldClick,
  onPinkClick,
  className = '',
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, '');
  const isEdges = variant === 'edges';

  const containerClass = isEdges
    ? `relative z-10 h-44 sm:h-52 w-full max-w-lg mx-auto pointer-events-none ${className}`
    : `relative z-10 h-36 sm:h-44 w-full max-w-sm mx-auto pointer-events-none ${className}`;

  const blueClass = isEdges
    ? 'pointer-events-auto absolute -left-24 sm:-left-16 bottom-6 w-[210px] h-[240px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EC2F3] rounded-full'
    : 'absolute -left-2 sm:left-0 -bottom-5 w-[156px] sm:w-[172px] h-[176px] sm:h-[194px] flex items-center justify-center';

  const goldClass = isEdges
    ? 'pointer-events-auto absolute left-1/2 -translate-x-1/2 -bottom-10 w-[264px] sm:w-[290px] h-[176px] sm:h-[188px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F7C648] rounded-full z-10'
    : 'absolute left-1/2 -translate-x-1/2 -bottom-9 w-[214px] sm:w-[236px] h-[142px] sm:h-[156px] flex items-center justify-center z-10';

  const pinkClass = isEdges
    ? 'pointer-events-auto absolute -right-24 sm:-right-16 bottom-8 w-[210px] h-[240px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EE86BF] rounded-full'
    : 'absolute -right-2 sm:right-0 -bottom-4 w-[156px] sm:w-[172px] h-[176px] sm:h-[194px] flex items-center justify-center';

  return (
    <div
      data-testid={isEdges ? 'welcome-back-trio-edges' : 'welcome-back-trio-centered'}
      aria-label="Mascotes interativos de boas-vindas"
      className={containerClass}
    >
      <CharacterShell
        id="blue"
        interactive={isEdges}
        ariaLabel={isEdges ? 'Gotinha azul observadora — ver postes acesos' : undefined}
        onClick={onBlueClick}
        className={blueClass}
        initial={prefersReducedMotion ? false : { x: -36, y: 18, opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0.01 } : SPRING_SETTLE}
        floatDuration={4.2}
        floatDelay={0}
        prefersReducedMotion={prefersReducedMotion}
        gaze={gaze}
      >
        <BlueMascotGraphic uid={uid} prefersReducedMotion={prefersReducedMotion} gaze={gaze} />
      </CharacterShell>

      <CharacterShell
        id="gold"
        interactive={isEdges}
        ariaLabel={isEdges ? 'Gotinha solar principal — toque para entrar' : undefined}
        onClick={onGoldClick}
        className={goldClass}
        initial={prefersReducedMotion ? false : { y: 44, opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0.01 } : { ...SPRING_SETTLE, delay: 0.08 }}
        floatDuration={4.8}
        floatDelay={0.4}
        prefersReducedMotion={prefersReducedMotion}
        gaze={gaze}
      >
        <GoldMascotGraphic uid={uid} prefersReducedMotion={prefersReducedMotion} gaze={gaze} />
      </CharacterShell>

      <CharacterShell
        id="pink"
        interactive={isEdges}
        ariaLabel={isEdges ? 'Gotinha rosa animada — colegas verificados' : undefined}
        onClick={onPinkClick}
        className={pinkClass}
        initial={prefersReducedMotion ? false : { x: 36, y: 18, opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0.01 } : { ...SPRING_SETTLE, delay: 0.12 }}
        floatDuration={4.5}
        floatDelay={0.25}
        prefersReducedMotion={prefersReducedMotion}
        gaze={gaze}
      >
        <PinkMascotGraphic uid={uid} prefersReducedMotion={prefersReducedMotion} gaze={gaze} />
      </CharacterShell>
    </div>
  );
};
