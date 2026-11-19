import React, { useEffect, useId, useMemo, useRef } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { isValidCpf, maskCpf } from '../../../security/schemas';
import ufscLogo from '../../../assets/ufsc-logo.webp';
import {
  CREW,
  HEART_PATH,
  INK,
  SPRINGS,
  STARS,
  TONGUE,
  blushPath,
  browPath,
  clamp,
  happyPath,
  heartAt,
  lerp,
  spring,
  starPath,
  step,
  type CrewId,
  type CrewMember,
  type Spring,
} from './crewPhysics';

export interface InteractiveCrewSignUpProps {
  name: string;
  onNameChange: (value: string) => void;
  affiliation: string;
  onAffiliationChange: (value: string) => void;
  cpf: string;
  onCpfChange: (value: string) => void;
  error: string | null;
  errorShakeKey: number;
  isVerifying: boolean;
  checklistStep: number;
  corridorLabel?: string;
  darkMode?: boolean;
  onAutofillDemo: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  onBack: () => void;
}

type FieldName = 'name' | 'affiliation' | 'cpf';

const VERIFICATION_STEPS = [
  { threshold: 1, label: 'Identidade Gov.br validada', activeColor: 'text-[#2563EB]', strong: false },
  { threshold: 2, label: 'Vínculo UFSC confirmado', activeColor: 'text-[#2563EB]', strong: false },
  { threshold: 3, label: 'Selo Verificado ativo (+100 XP)', activeColor: 'text-[#10B981]', strong: true },
] as const;

// Render blue & pink first so center gold dome layers warmly in front (matching WelcomeBack)
const STAGE_CREW_ORDER: readonly CrewMember[] = [CREW[0]!, CREW[2]!, CREW[1]!];

const FIELD_GAZE_Y: Record<FieldName, number> = {
  name: -0.15,
  affiliation: 0.25,
  cpf: 0.65,
};

/**
 * Formats user-typed CPF digits into 000.000.000-00 while keeping raw CPF ephemeral (never persisted).
 */
function formatCpfInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function resolveErrorField(error: string | null): FieldName | null {
  if (!error) return null;
  const lower = error.toLowerCase();
  if (lower.includes('cpf')) return 'cpf';
  if (lower.includes('vínculo') || lower.includes('vinculo')) return 'affiliation';
  if (lower.includes('nome')) return 'name';
  return 'cpf';
}

function getInputClassName(
  isFieldError: boolean,
  isFieldValid: boolean,
  darkMode: boolean,
  extraPadding = 'px-3.5'
): string {
  const base = darkMode
    ? `w-full min-h-[46px] ${extraPadding} py-2.5 rounded-2xl bg-[#0E1319] text-sm text-[#E5E4E2] placeholder:text-[#6C8193] shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-all focus-visible:outline-2 focus-visible:outline-[#5EC2F3]`
    : `w-full min-h-[46px] ${extraPadding} py-2.5 rounded-2xl bg-white/95 text-sm text-[#0F172A] placeholder:text-[#94A3B8] shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-all focus-visible:outline-2 focus-visible:outline-[#2563EB]`;

  if (isFieldError) {
    return `${base} ring-2 ring-[#EF4444]/80 ${darkMode ? 'bg-[#2B1215]/70' : 'bg-red-50/50'}`;
  }
  if (isFieldValid) {
    return `${base} ring-2 ring-[#22C55E]/70 ${darkMode ? 'bg-[#0F2418]/70' : 'bg-[#F0FDF4]/70'}`;
  }
  return `${base} border ${darkMode ? 'border-white/12' : 'border-white'}`;
}

interface MemberRefs {
  root: SVGGElement | null;
  face: SVGGElement | null;
  eyeGroups: Array<SVGGElement | null>;
  happyEyes: Array<SVGPathElement | null>;
  brows: Array<SVGPathElement | null>;
  mouthClosed: SVGPathElement | null;
  mouthOpen: SVGGElement | null;
  blush: SVGGElement | null;
  heart: SVGPathElement | null;
}

interface MemberPhysics {
  worry: Spring;
  joy: Spring;
  relief: Spring;
  hop: Spring;
  lean: Spring;
  shake: Spring;
  squash: Spring;
  turnX: Spring;
  turnY: Spring;
  eyeX: Spring[];
  eyeY: Spring[];
  hopBeatsFired: number;
}

function createMemberPhysics(member: CrewMember): MemberPhysics {
  return {
    worry: spring(...SPRINGS.worry),
    joy: spring(...SPRINGS.joy),
    relief: spring(...SPRINGS.relief),
    hop: spring(...SPRINGS.hop),
    lean: spring(...SPRINGS.lean),
    shake: spring(...SPRINGS.shake),
    squash: spring(...SPRINGS.squash),
    turnX: spring(...SPRINGS.turn),
    turnY: spring(...SPRINGS.turn),
    eyeX: member.eyes.map(() => spring(...SPRINGS.eye)),
    eyeY: member.eyes.map(() => spring(...SPRINGS.eye)),
    hopBeatsFired: 0,
  };
}

function buildClosedMouthPath(ox: number, oy: number, w: number, curve: number): string {
  const half = w * 0.5;
  const x1 = ox - half;
  const x2 = ox + half;
  const cy = oy + curve;
  return `M${x1.toFixed(2)},${oy.toFixed(2)} Q${ox.toFixed(2)},${cy.toFixed(2)} ${x2.toFixed(2)},${oy.toFixed(2)}`;
}

function buildOpenMouthPaths(ox: number, oy: number, w: number): { outer: string; tongue: string } {
  const half = w * 0.62;
  const depth = w * 0.82;
  const topY = oy - 2.2;
  const outer = `M${(ox - half).toFixed(2)},${topY.toFixed(2)} L${(ox + half).toFixed(2)},${topY.toFixed(2)} Q${(ox + half).toFixed(2)},${(topY + depth).toFixed(2)} ${ox.toFixed(2)},${(topY + depth).toFixed(2)} Q${(ox - half).toFixed(2)},${(topY + depth).toFixed(2)} ${(ox - half).toFixed(2)},${topY.toFixed(2)} Z`;
  const tw = half * 0.62;
  const tongue = `M${(ox - tw).toFixed(2)},${(topY + depth * 0.86).toFixed(2)} Q${ox.toFixed(2)},${(topY + depth * 0.35).toFixed(2)} ${(ox + tw).toFixed(2)},${(topY + depth * 0.86).toFixed(2)} Q${ox.toFixed(2)},${(topY + depth * 1.05).toFixed(2)} ${(ox - tw).toFixed(2)},${(topY + depth * 0.86).toFixed(2)} Z`;
  return { outer, tongue };
}

export const InteractiveCrewSignUp: React.FC<InteractiveCrewSignUpProps> = ({
  name,
  onNameChange,
  affiliation,
  onAffiliationChange,
  cpf,
  onCpfChange,
  error,
  errorShakeKey,
  isVerifying,
  checklistStep,
  darkMode = false,
  onAutofillDemo,
  onSubmit,
  onBack,
}) => {
  const uid = useId().replace(/:/g, '');
  const prefersReducedMotion = usePrefersReducedMotion();

  const isCpfValid = useMemo(() => isValidCpf(cpf), [cpf]);
  const maskedPreview = useMemo(() => (isCpfValid ? maskCpf(cpf) : null), [cpf, isCpfValid]);
  const isSuccess = isVerifying && checklistStep >= 3;
  const errorField = useMemo(() => resolveErrorField(error), [error]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const fieldWrapRefs = useRef<Record<FieldName, HTMLDivElement | null>>({
    name: null,
    affiliation: null,
    cpf: null,
  });

  const memberRefs = useRef<Record<CrewId, MemberRefs>>({
    blue: { root: null, face: null, eyeGroups: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, heart: null },
    gold: { root: null, face: null, eyeGroups: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, heart: null },
    pink: { root: null, face: null, eyeGroups: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, heart: null },
  });

  const starRefs = useRef<Array<SVGPathElement | null>>([]);

  // Mutable animation target state — read by rAF without triggering React re-renders
  const targetRef = useRef({
    focusedField: null as FieldName | null,
    caretRatio: 0.5,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    hasError: false,
    errorField: null as FieldName | null,
    errorShakeKey: 0,
    isCpfValid: false,
    isVerifying: false,
    isSuccess: false,
  });

  targetRef.current.hasError = Boolean(error);
  targetRef.current.errorField = errorField;
  targetRef.current.errorShakeKey = errorShakeKey;
  targetRef.current.isCpfValid = isCpfValid;
  targetRef.current.isVerifying = isVerifying;
  targetRef.current.isSuccess = isSuccess;

  const updateCaretFromInput = (field: FieldName, input: HTMLInputElement) => {
    targetRef.current.focusedField = field;
    const pos = input.selectionStart ?? input.value.length;
    const maxChars = field === 'cpf' ? 14 : 26;
    targetRef.current.caretRatio = clamp(pos / maxChars, 0.06, 0.96);
  };

  const handleCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    targetRef.current.pointerActive = true;
    targetRef.current.pointerX = clamp(nx, -1, 1);
    targetRef.current.pointerY = clamp(ny, -1, 1);
  };

  const handleCardPointerLeave = () => {
    targetRef.current.pointerActive = false;
  };

  // Apply a calm static pose when prefers-reduced-motion is enabled (no rAF loop)
  useEffect(() => {
    if (!prefersReducedMotion) return;

    const worry = error ? 0.85 : 0;
    const joy = isSuccess ? 1 : 0;
    const relief = !error && isCpfValid ? 0.7 : 0;

    CREW.forEach((m) => {
      const dom = memberRefs.current[m.id];
      if (!dom.root) return;

      dom.root.setAttribute('transform', `translate(${m.cx},${m.cy}) rotate(${m.baseTilt})`);
      if (dom.face) dom.face.setAttribute('transform', 'translate(0,0)');

      m.eyes.forEach((eye, i) => {
        const eg = dom.eyeGroups[i];
        const hap = dom.happyEyes[i];
        const brow = dom.brows[i];

        if (eg) {
          const squintY = worry > 0.2 ? 0.56 : 1;
          eg.setAttribute('opacity', joy > 0.5 ? '0' : '1');
          eg.setAttribute('transform', `translate(${eye.ox},${eye.oy}) scale(1,${squintY})`);
        }
        if (hap) hap.setAttribute('opacity', joy > 0.5 ? '1' : '0');
        if (brow) {
          const side: -1 | 1 = m.eyes.length === 1 ? -1 : i === 0 ? -1 : 1;
          brow.setAttribute('d', browPath(eye.ox, eye.oy, eye.r, side, worry));
          brow.setAttribute('opacity', worry > 0.2 ? '0.9' : '0');
        }
      });

      if (dom.mouthClosed) {
        const curve = worry > 0.2 ? -4.0 : relief > 0.2 ? 6.2 : 3.6;
        dom.mouthClosed.setAttribute('d', buildClosedMouthPath(m.mouth.ox, m.mouth.oy, m.mouth.w, curve));
        dom.mouthClosed.setAttribute('opacity', joy > 0.5 ? '0' : '1');
      }
      if (dom.mouthOpen) {
        dom.mouthOpen.setAttribute('opacity', joy > 0.5 ? '1' : '0');
      }
      if (dom.blush) {
        dom.blush.setAttribute('opacity', joy > 0.5 ? '0.9' : relief > 0.2 ? '0.45' : '0');
      }
      if (dom.heart) {
        dom.heart.setAttribute('opacity', joy > 0.5 ? '0.95' : '0');
        dom.heart.setAttribute('transform', heartAt(m.heartOffset.ox, m.heartOffset.oy, 0.9, 0));
      }
    });
  }, [prefersReducedMotion, error, isCpfValid, isSuccess]);

  // Imperative 60fps Oglet physics rAF engine — ZERO React setState calls inside the loop
  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return;
    }

    const physics: Record<CrewId, MemberPhysics> = {
      blue: createMemberPhysics(CREW[0]!),
      gold: createMemberPhysics(CREW[1]!),
      pink: createMemberPhysics(CREW[2]!),
    };

    let lookX = 0;
    let lookY = 0;
    let lastErrorKey = targetRef.current.errorShakeKey;
    let lastCpfValid = targetRef.current.isCpfValid;
    let lastSuccess = targetRef.current.isSuccess;

    let fieldShakeElapsed = -1;
    let shakingField: FieldName | null = null;
    let reliefPulse = 0;
    let successElapsed = -1;

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.05);
      lastTime = now;
      elapsed += dt;

      const t = targetRef.current;

      // 1. Detect discrete state impulses without re-subscribing rAF
      if (t.errorShakeKey !== lastErrorKey) {
        lastErrorKey = t.errorShakeKey;
        if (t.hasError) {
          fieldShakeElapsed = 0;
          shakingField = t.errorField ?? 'cpf';
          CREW.forEach((m) => {
            const p = physics[m.id];
            p.shake.v += m.shakeSign * 260;
            p.squash.v -= 13;
          });
        }
      }

      if (t.isCpfValid && !lastCpfValid) {
        reliefPulse = 1.0;
        CREW.forEach((m, idx) => {
          const p = physics[m.id];
          p.relief.v += 16;
          p.hop.v -= 105 + idx * 8;
          p.squash.v += 9.5;
        });
      }
      lastCpfValid = t.isCpfValid;

      if (t.isSuccess && !lastSuccess) {
        successElapsed = 0;
        CREW.forEach((m) => {
          physics[m.id].hopBeatsFired = 0;
        });
      } else if (!t.isSuccess) {
        successElapsed = -1;
      }
      lastSuccess = t.isSuccess;

      // 2. Invalid field damped sinusoidal shake: 8px * sin(5πu) * (1 - u)
      if (fieldShakeElapsed >= 0 && shakingField) {
        const dur = 0.42;
        fieldShakeElapsed += dt;
        const u = clamp(fieldShakeElapsed / dur, 0, 1);
        const wrap = fieldWrapRefs.current[shakingField];
        if (wrap) {
          if (u >= 1) {
            wrap.style.transform = '';
            fieldShakeElapsed = -1;
          } else {
            const dx = 8 * Math.sin(5 * Math.PI * u) * (1 - u);
            wrap.style.transform = `translate3d(${dx.toFixed(2)}px,0,0)`;
          }
        } else if (u >= 1) {
          fieldShakeElapsed = -1;
        }
      }

      // 3. Smooth gaze target eased at rate 6/s
      let rawGazeX = 0;
      let rawGazeY = 0;
      if (t.focusedField) {
        rawGazeX = t.caretRatio * 2 - 1;
        rawGazeY = FIELD_GAZE_Y[t.focusedField];
      } else if (t.pointerActive) {
        rawGazeX = t.pointerX;
        rawGazeY = t.pointerY;
      } else {
        rawGazeX = Math.sin(elapsed * 0.55) * 0.12;
        rawGazeY = Math.cos(elapsed * 0.42) * 0.08;
      }

      const gazeBlend = 1 - Math.exp(-6 * dt);
      lookX = lerp(lookX, rawGazeX, gazeBlend);
      lookY = lerp(lookY, rawGazeY, gazeBlend);

      if (reliefPulse > 0) {
        reliefPulse = Math.max(0, reliefPulse - dt * 0.9);
      }
      if (successElapsed >= 0) {
        successElapsed += dt;
      }

      const worryTarget = t.hasError && !t.isSuccess ? 1 : 0;
      const joyTarget = t.isSuccess ? 1 : 0;
      const reliefTarget = !t.hasError && t.isCpfValid ? Math.max(0.55, reliefPulse) : 0;

      // 4. Update each of the 3 WelcomeBack Trio members
      CREW.forEach((m) => {
        const dom = memberRefs.current[m.id];
        if (!dom.root) return;
        const p = physics[m.id];

        // Trigger 3 staggered squash-and-stretch celebration hops (0.08s stagger)
        if (successElapsed >= 0 && p.hopBeatsFired < 3) {
          const nextBeatTime = m.hopDelay + p.hopBeatsFired * 0.34;
          if (successElapsed >= nextBeatTime) {
            p.hopBeatsFired += 1;
            p.hop.v -= 225;
            p.squash.v += 16;
          }
        }

        const worry = clamp(step(p.worry, worryTarget, dt), 0, 1.15);
        const joy = clamp(step(p.joy, joyTarget, dt), 0, 1.2);
        const relief = clamp(step(p.relief, reliefTarget, dt), 0, 1.2);
        const hopY = step(p.hop, 0, dt);
        const shakeDeg = step(p.shake, 0, dt) * 0.42;
        const squashVal = clamp(step(p.squash, 0, dt) * 0.032, -0.22, 0.24);

        const dx = clamp(lookX - m.anchorX * 0.42, -1.2, 1.2);
        const dy = clamp(lookY - m.anchorY * 0.36, -1.2, 1.2);

        const leanTarget = clamp(dx * 5, -5, 5);
        const leanDeg = step(p.lean, leanTarget, dt);

        const turnX = step(p.turnX, dx * 6.2, dt);
        const turnY = step(p.turnY, dy * 3.8, dt);

        const bob = Math.sin(elapsed * m.bobSpeed + m.bobPhase) * 2.4;
        const scaleX = 1 - squashVal * 0.65;
        const scaleY = 1 + squashVal;
        const totalRot = m.baseTilt + leanDeg + shakeDeg;
        const totalY = m.cy + bob + hopY;

        dom.root.setAttribute(
          'transform',
          `translate(${m.cx.toFixed(2)},${totalY.toFixed(2)}) rotate(${totalRot.toFixed(2)}) scale(${scaleX.toFixed(3)},${scaleY.toFixed(3)})`
        );

        if (dom.face) {
          dom.face.setAttribute(
            'transform',
            `translate(${turnX.toFixed(2)},${turnY.toFixed(2)})`
          );
        }

        const squintY = lerp(1, 0.48, clamp(worry, 0, 1));
        const reliefScale = 1 + clamp(relief, 0, 1) * 0.06;
        const showHappy = joy > 0.48;

        m.eyes.forEach((eye, i) => {
          const maxTravel = 3.8;
          const dist = Math.hypot(dx, dy) || 1;
          const clampedMag = Math.min(1, dist);
          const eTargetX = (dx / dist) * clampedMag * maxTravel;
          const eTargetY = (dy / dist) * clampedMag * maxTravel;

          const ex = step(p.eyeX[i]!, eTargetX, dt);
          const ey = step(p.eyeY[i]!, eTargetY, dt);
          const eDist = Math.hypot(ex, ey);
          const fex = eDist > maxTravel ? (ex / eDist) * maxTravel : ex;
          const fey = eDist > maxTravel ? (ey / eDist) * maxTravel : ey;

          const eg = dom.eyeGroups[i];
          const hap = dom.happyEyes[i];
          const brow = dom.brows[i];

          if (eg) {
            eg.setAttribute('opacity', showHappy ? '0' : '1');
            eg.setAttribute(
              'transform',
              `translate(${(eye.ox + fex).toFixed(2)},${(eye.oy + fey).toFixed(2)}) scale(${reliefScale.toFixed(3)},${(squintY * reliefScale).toFixed(3)})`
            );
          }

          if (hap) {
            hap.setAttribute('opacity', showHappy ? clamp((joy - 0.4) * 2.2, 0, 1).toFixed(3) : '0');
          }

          if (brow) {
            const side: -1 | 1 = m.eyes.length === 1 ? (dx >= 0 ? -1 : 1) : i === 0 ? -1 : 1;
            brow.setAttribute('d', browPath(eye.ox, eye.oy, eye.r, side, clamp(worry, 0, 1)));
            brow.setAttribute('opacity', clamp(worry * 1.1, 0, 0.92).toFixed(3));
          }
        });

        if (dom.mouthClosed) {
          const baseCurve = 3.8 + relief * 3.0 - worry * 7.8;
          dom.mouthClosed.setAttribute(
            'd',
            buildClosedMouthPath(m.mouth.ox, m.mouth.oy, m.mouth.w, baseCurve)
          );
          dom.mouthClosed.setAttribute('opacity', showHappy ? '0' : '1');
        }
        if (dom.mouthOpen) {
          const openOp = showHappy ? clamp((joy - 0.42) * 2.4, 0, 1) : 0;
          dom.mouthOpen.setAttribute('opacity', openOp.toFixed(3));
        }

        if (dom.blush) {
          const blushOp = clamp(joy * 0.9 + relief * 0.42, 0, 0.95);
          dom.blush.setAttribute('opacity', blushOp.toFixed(3));
        }

        if (dom.heart) {
          const hOp = clamp((joy - 0.35) * 1.8, 0, 0.96);
          const floatY = -((elapsed * 16 + m.hopDelay * 30) % 18);
          const swayX = Math.sin(elapsed * 4.2 + m.bobPhase) * 4.5;
          const rot = Math.sin(elapsed * 3.5 + m.bobPhase) * 12;
          dom.heart.setAttribute('opacity', hOp.toFixed(3));
          dom.heart.setAttribute(
            'transform',
            heartAt(m.heartOffset.ox + swayX, m.heartOffset.oy + floatY, 0.75 + joy * 0.25, rot)
          );
        }
      });

      // 5. Ambient 4-point star sparkles twinkle & burst bigger on celebration
      const joyBurst = clamp(physics.gold.joy.x, 0, 1.2);
      STARS.forEach((st, idx) => {
        const el = starRefs.current[idx];
        if (!el) return;
        const pulse = 0.85 + 0.22 * Math.sin(elapsed * 3.2 + st.phase);
        const burstScale = (1 + joyBurst * 0.65) * pulse;
        const rot = joyBurst * 26 * (idx % 2 === 0 ? 1 : -1) + Math.sin(elapsed * 1.4 + st.phase) * 8;
        el.setAttribute(
          'transform',
          `translate(${st.x},${st.y}) rotate(${rot.toFixed(1)}) scale(${burstScale.toFixed(3)}) translate(${-st.x},${-st.y})`
        );
        el.setAttribute('opacity', clamp(0.65 + joyBurst * 0.35, 0.5, 1).toFixed(3));
      });

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion]);

  const renderCrewMember = (m: CrewMember) => {
    const gradId = `${uid}-grad-${m.id}`;
    const blurId = `${uid}-blur-${m.id}`;
    const haloBlurId = `${uid}-haloblur-${m.id}`;
    const openMouth = buildOpenMouthPaths(m.mouth.ox, m.mouth.oy, m.mouth.w);

    return (
      <g
        key={m.id}
        data-member={m.id}
        ref={(el) => {
          memberRefs.current[m.id].root = el;
        }}
        transform={`translate(${m.cx},${m.cy}) rotate(${m.baseTilt})`}
      >
        <defs>
          <radialGradient id={gradId} cx="42%" cy="35%" r="68%">
            <stop offset="0%" stopColor={m.highlight} />
            <stop offset="100%" stopColor={m.color} />
          </radialGradient>
          <filter id={blurId} x="-18%" y="-18%" width="136%" height="136%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
          <filter id={haloBlurId} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="11" />
          </filter>
        </defs>

        {/* Soft luminous pastel aura behind each mascot */}
        <ellipse
          cx="0"
          cy="4"
          rx={m.rx + 12}
          ry={m.ry + 12}
          fill={m.haloColor}
          filter={`url(#${haloBlurId})`}
        />

        {/* Soft-diffused pastel organic oval body matching WelcomeBackOverlay */}
        <path
          d={m.bodyPath}
          fill={`url(#${gradId})`}
          filter={`url(#${blurId})`}
        />

        {/* Warm expressive WelcomeBack face group with 3D turn slide (zero white sclera eyeballs) */}
        <g
          ref={(el) => {
            memberRefs.current[m.id].face = el;
          }}
        >
          {/* Blue's subtle freckles */}
          {m.freckles?.map((f, idx) => (
            <circle
              key={`freckle-${idx}`}
              cx={f.ox}
              cy={f.oy}
              r={f.r}
              fill="#3299D4"
              opacity="0.35"
            />
          ))}

          {/* Friendly dark capsule/slanted eyes + 4-point white star sparkles */}
          {m.eyes.map((eye, idx) => (
            <g
              key={`eye-${idx}`}
              ref={(el) => {
                memberRefs.current[m.id].eyeGroups[idx] = el;
              }}
              transform={`translate(${eye.ox},${eye.oy})`}
            >
              <path d={eye.path} fill={INK} />
              <path
                d={starPath(eye.sparkle.ox, eye.sparkle.oy, eye.sparkle.r)}
                fill="#FFFFFF"
                opacity="0.95"
              />
            </g>
          ))}

          {/* Happy ^ ^ celebration eye arcs */}
          {m.eyes.map((eye, idx) => (
            <path
              key={`happy-${idx}`}
              ref={(el) => {
                memberRefs.current[m.id].happyEyes[idx] = el;
              }}
              d={happyPath(eye.ox, eye.oy, eye.r)}
              fill="none"
              stroke={INK}
              strokeWidth="2.8"
              strokeLinecap="round"
              opacity="0"
            />
          ))}

          {/* Subtle worried brows on invalid input */}
          {m.eyes.map((eye, idx) => (
            <path
              key={`brow-${idx}`}
              ref={(el) => {
                memberRefs.current[m.id].brows[idx] = el;
              }}
              d={browPath(eye.ox, eye.oy, eye.r, idx === 0 ? -1 : 1, 0)}
              fill="none"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0"
            />
          ))}

          {/* Blush strokes */}
          <g
            ref={(el) => {
              memberRefs.current[m.id].blush = el;
            }}
            opacity="0"
          >
            {m.blush.map((b, idx) => (
              <path
                key={idx}
                d={blushPath(b.ox, b.oy)}
                fill="none"
                stroke={TONGUE}
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* Closed expressive mouth (neutral / relief / gentle frown) */}
          <path
            ref={(el) => {
              memberRefs.current[m.id].mouthClosed = el;
            }}
            d={buildClosedMouthPath(m.mouth.ox, m.mouth.oy, m.mouth.w, 3.8)}
            fill="none"
            stroke={INK}
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Celebration open ink grin + pink tongue */}
          <g
            ref={(el) => {
              memberRefs.current[m.id].mouthOpen = el;
            }}
            opacity="0"
          >
            <path d={openMouth.outer} fill={INK} />
            <path d={openMouth.tongue} fill={TONGUE} />
          </g>
        </g>

        {/* Joy celebration floating heart */}
        <path
          ref={(el) => {
            memberRefs.current[m.id].heart = el;
          }}
          d={HEART_PATH}
          fill={TONGUE}
          opacity="0"
          transform={heartAt(m.heartOffset.ox, m.heartOffset.oy, 0.8)}
        />
      </g>
    );
  };

  return (
    <div
      className={`-mx-5 -my-5 sm:-mx-8 sm:-my-8 px-4 pt-4 pb-6 sm:px-6 sm:pt-5 sm:pb-7 font-sans relative overflow-hidden transition-colors duration-300 ${
        darkMode ? 'text-[#E5E4E2]' : 'text-[#0F172A]'
      }`}
      style={{
        fontFamily: "'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        background: darkMode
          ? 'linear-gradient(180deg, #0F1A26 0%, #0C1219 42%, #0A0A0A 100%)'
          : 'linear-gradient(180deg, #D9EEFF 0%, #EAF5FF 36%, #F4F9FF 72%, #FFFFFF 100%)',
      }}
    >
      {/* Subtle atmospheric pastel glow aura */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-20 -left-16 w-64 h-64 rounded-full blur-3xl ${
          darkMode ? 'bg-[#5EC2F3]/14' : 'bg-[#5EC2F3]/26'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-12 -right-14 w-60 h-60 rounded-full blur-3xl ${
          darkMode ? 'bg-[#EE86BF]/12' : 'bg-[#EE86BF]/20'
        }`}
      />

      {/* Clean Top Bar: Voltar + Centered UFSC Crest */}
      <div className="flex items-center justify-between gap-2 mb-2 relative z-20">
        <div className="w-[84px] flex items-center justify-start">
          <button
            type="button"
            onClick={onBack}
            disabled={isVerifying}
            className={`min-h-[44px] inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold backdrop-blur-xl active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
              darkMode
                ? 'text-[#E5E4E2] bg-white/10 border border-white/15 hover:bg-white/15'
                : 'text-[#0F172A] bg-white/80 border border-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] hover:bg-white'
            }`}
          >
            <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Voltar</span>
          </button>
        </div>

        <img
          src={ufscLogo}
          alt="UFSC"
          width={119}
          height={160}
          decoding="async"
          className={`h-9 w-auto object-contain select-none pointer-events-none ${
            darkMode ? 'brightness-0 invert opacity-90' : ''
          }`}
        />

        <div className="w-[84px]" aria-hidden="true" />
      </div>

      {/* Interactive WelcomeBack Trio Stage + Clean Frosted Card */}
      <div
        ref={cardRef}
        onPointerMove={handleCardPointerMove}
        onPointerLeave={handleCardPointerLeave}
        className="relative mt-1"
      >
        {/* WELCOMEBACK TRIO SVG STAGE */}
        <div className="relative z-0 -mb-6 pointer-events-none select-none" aria-hidden="true">
          <svg
            viewBox="0 0 400 132"
            className="w-full h-auto block overflow-visible"
            role="presentation"
          >
            {STARS.map((st, idx) => (
              <path
                key={idx}
                ref={(el) => {
                  starRefs.current[idx] = el;
                }}
                d={starPath(st.x, st.y, st.r)}
                fill={st.color}
                opacity="0.72"
              />
            ))}
            {STAGE_CREW_ORDER.map(renderCrewMember)}
          </svg>
        </div>

        {/* CLEAN FROSTED CARD */}
        <div className="relative z-10 rounded-[28px] bg-[var(--bg-elevated)] backdrop-blur-2xl border border-[var(--separator)] shadow-[0_24px_60px_rgba(15,23,42,0.10)] px-4 pt-5 pb-6 sm:px-6 sm:pt-6 sm:pb-7 transition-colors duration-300">
          {/* Header & Dynamic Crew Subtitle */}
          <div className="text-center mb-4">
            <h2 className="text-[22px] sm:text-2xl font-semibold tracking-[-0.02em] text-[var(--label-primary)] leading-tight">
              Validação única Gov.br
            </h2>
            <p
              className={`text-xs sm:text-[13px] mt-1 transition-colors ${
                error
                  ? darkMode
                    ? 'text-[#FF6961] font-medium'
                    : 'text-[#D70015] font-medium'
                  : 'text-[var(--label-secondary)]'
              }`}
            >
              {error
                ? 'Ops! Confira os campos destacados'
                : 'Identificação institucional segura para caminhar com colegas verificados'}
            </p>
          </div>

          {/* Gov.br Form */}
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            {/* Nome completo */}
            <div
              ref={(el) => {
                fieldWrapRefs.current.name = el;
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="govbr-name"
                  className="block text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider"
                >
                  Nome completo
                </label>
                <button
                  type="button"
                  onClick={onAutofillDemo}
                  disabled={isVerifying}
                  className={`min-h-[44px] inline-flex items-center px-2 text-xs font-semibold hover:underline cursor-pointer rounded-full disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    darkMode
                      ? 'text-[#5EC2F3] focus-visible:outline-[#5EC2F3]'
                      : 'text-[#2563EB] focus-visible:outline-[#2563EB]'
                  }`}
                >
                  Preencher demo Gov.br
                </button>
              </div>
              <input
                id="govbr-name"
                type="text"
                aria-label="Nome completo"
                autoComplete="name"
                value={name}
                onFocus={(e) => updateCaretFromInput('name', e.currentTarget)}
                onBlur={() => {
                  if (targetRef.current.focusedField === 'name') {
                    targetRef.current.focusedField = null;
                  }
                }}
                onSelect={(e) => updateCaretFromInput('name', e.currentTarget)}
                onChange={(e) => {
                  updateCaretFromInput('name', e.currentTarget);
                  onNameChange(e.target.value);
                }}
                placeholder="Ex: Mariana Silva"
                disabled={isVerifying}
                className={getInputClassName(Boolean(error && errorField === 'name'), false, darkMode)}
              />
            </div>

            {/* Vínculo UFSC */}
            <div
              ref={(el) => {
                fieldWrapRefs.current.affiliation = el;
              }}
            >
              <label
                htmlFor="govbr-affiliation"
                className="block text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-1"
              >
                Vínculo UFSC
              </label>
              <input
                id="govbr-affiliation"
                type="text"
                aria-label="Vínculo UFSC"
                value={affiliation}
                onFocus={(e) => updateCaretFromInput('affiliation', e.currentTarget)}
                onBlur={() => {
                  if (targetRef.current.focusedField === 'affiliation') {
                    targetRef.current.focusedField = null;
                  }
                }}
                onSelect={(e) => updateCaretFromInput('affiliation', e.currentTarget)}
                onChange={(e) => {
                  updateCaretFromInput('affiliation', e.currentTarget);
                  onAffiliationChange(e.target.value);
                }}
                placeholder="Ex: Ciência da Computação • 6ª fase"
                disabled={isVerifying}
                className={getInputClassName(Boolean(error && errorField === 'affiliation'), false, darkMode)}
              />
            </div>

            {/* CPF with live formatting, green ✓ relief trigger, and masked privacy preview */}
            <div
              ref={(el) => {
                fieldWrapRefs.current.cpf = el;
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="govbr-cpf"
                  className="block text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider"
                >
                  CPF
                </label>
                {maskedPreview && (
                  <span className={`text-[11px] font-medium ${darkMode ? 'text-[#34D399]' : 'text-[#059669]'}`}>
                    Salvo como {maskedPreview}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="govbr-cpf"
                  type="text"
                  inputMode="numeric"
                  aria-label="CPF"
                  value={cpf}
                  onFocus={(e) => updateCaretFromInput('cpf', e.currentTarget)}
                  onBlur={() => {
                    if (targetRef.current.focusedField === 'cpf') {
                      targetRef.current.focusedField = null;
                    }
                  }}
                  onSelect={(e) => updateCaretFromInput('cpf', e.currentTarget)}
                  onChange={(e) => {
                    const formatted = formatCpfInput(e.target.value);
                    updateCaretFromInput('cpf', e.currentTarget);
                    onCpfChange(formatted);
                  }}
                  placeholder="000.000.000-00"
                  disabled={isVerifying}
                  className={getInputClassName(Boolean(error && errorField === 'cpf'), isCpfValid, darkMode, 'pl-3.5 pr-11')}
                />
                {isCpfValid && (
                  <span
                    aria-label="CPF válido"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#22C55E] text-white inline-flex items-center justify-center shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                  </span>
                )}
              </div>
            </div>

            {/* Fail-fast inline error alert */}
            {error && (
              <div
                role="alert"
                className={`t-error-msg p-3 rounded-2xl border text-xs font-medium ${
                  darkMode
                    ? 'bg-[#2B1215]/90 border-[#EF4444]/35 text-[#FF6961]'
                    : 'bg-red-50/90 border-red-200/80 text-[#D70015]'
                }`}
              >
                {error}
              </div>
            )}

            {/* 3-Stage Verification Checklist */}
            {isVerifying && (
              <div
                className={`p-3.5 rounded-2xl border space-y-2 shadow-2xs ${
                  darkMode
                    ? 'bg-[#0E1319]/90 border-white/10'
                    : 'bg-white/90 border-[#DBEAFE]'
                }`}
              >
                {VERIFICATION_STEPS.map((item) => {
                  const isDone = checklistStep >= item.threshold;
                  return (
                    <div key={item.threshold} className="flex items-center gap-2.5 text-xs">
                      <CheckCircle2
                        className={`w-4 h-4 transition-colors ${
                          isDone ? item.activeColor : 'text-[#94A3B8]'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={
                          isDone
                            ? `text-[var(--label-primary)] ${item.strong ? 'font-semibold' : 'font-medium'}`
                            : 'text-[var(--label-secondary)]'
                        }
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Primary Onyx Apple Capsule CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isVerifying}
                className={`w-full min-h-[50px] px-5 py-3 rounded-full text-sm font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isSuccess
                    ? 'bg-[#22C55E] text-white shadow-[0_10px_24px_rgba(34,197,94,0.35)] focus-visible:outline-[#22C55E]'
                    : darkMode
                      ? 'bg-white hover:bg-white/92 active:scale-[0.98] text-[#0A0A0A] shadow-[0_10px_28px_rgba(255,255,255,0.14)] focus-visible:outline-white'
                      : 'bg-[#111827] hover:bg-[#1F2937] active:scale-[0.98] text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)] focus-visible:outline-[#111827]'
                }`}
              >
                {isSuccess ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                    <span>Tudo certo!</span>
                  </>
                ) : (
                  <>
                    <span>Validar e entrar</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
