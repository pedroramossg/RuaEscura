import React, { useEffect, useId, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  LockOpen,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { isValidCpf, maskCpf } from '../../../security/schemas';
import {
  CREW,
  EYE_WHITE,
  HEART_PATH,
  INK,
  INK_RGB,
  SPRINGS,
  STARS,
  SWEAT_PATH,
  TONGUE,
  blushPath,
  browPath,
  clamp,
  eio,
  happyPath,
  heartAt,
  lerp,
  spring,
  starPath,
  step,
  sweatAt,
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
  gpsStatus: 'prompt' | 'granted' | 'fallback';
  onRequestGps: () => void;
  isVerifying: boolean;
  checklistStep: number;
  corridorLabel: string;
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

const BACK_CREW = CREW.filter((m) => m.layer === 'back');
const FRONT_CREW = CREW.filter((m) => m.layer === 'front');

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

interface MemberRefs {
  root: SVGGElement | null;
  face: SVGGElement | null;
  eyeGroups: Array<SVGGElement | null>;
  pupils: Array<SVGGElement | null>;
  lids: Array<SVGRectElement | null>;
  happyEyes: Array<SVGPathElement | null>;
  brows: Array<SVGPathElement | null>;
  mouthClosed: SVGPathElement | null;
  mouthOpen: SVGGElement | null;
  blush: SVGGElement | null;
  sweat: SVGPathElement | null;
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
  pupilX: Spring[];
  pupilY: Spring[];
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
    pupilX: member.eyes.map(() => spring(...SPRINGS.pupil)),
    pupilY: member.eyes.map(() => spring(...SPRINGS.pupil)),
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
  const depth = w * 0.85;
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
  gpsStatus,
  onRequestGps,
  isVerifying,
  checklistStep,
  corridorLabel,
  onAutofillDemo,
  onSubmit,
  onBack,
}) => {
  const uid = useId();
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
    sky: { root: null, face: null, eyeGroups: [], pupils: [], lids: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, sweat: null, heart: null },
    cobalt: { root: null, face: null, eyeGroups: [], pupils: [], lids: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, sweat: null, heart: null },
    gold: { root: null, face: null, eyeGroups: [], pupils: [], lids: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, sweat: null, heart: null },
    pink: { root: null, face: null, eyeGroups: [], pupils: [], lids: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, sweat: null, heart: null },
    mint: { root: null, face: null, eyeGroups: [], pupils: [], lids: [], happyEyes: [], brows: [], mouthClosed: null, mouthOpen: null, blush: null, sweat: null, heart: null },
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
        const pup = dom.pupils[i];
        const lid = dom.lids[i];
        const hap = dom.happyEyes[i];
        const brow = dom.brows[i];

        if (eg) {
          eg.setAttribute('opacity', joy > 0.5 ? '0' : '1');
          eg.setAttribute('transform', `translate(${eye.ox},${eye.oy}) scale(1)`);
        }
        if (pup) pup.setAttribute('transform', 'translate(0,0) scale(1)');
        if (lid) lid.setAttribute('y', String(worry > 0.2 ? -eye.r - eye.r * 1.4 : -eye.r * 3.1));
        if (hap) hap.setAttribute('opacity', joy > 0.5 ? '1' : '0');
        if (brow) {
          const side: -1 | 1 = m.eyes.length === 1 ? -1 : i === 0 ? -1 : 1;
          brow.setAttribute('d', browPath(eye.ox, eye.oy, eye.r, side, worry));
          brow.setAttribute('opacity', worry > 0.2 ? '0.95' : '0');
        }
      });

      if (dom.mouthClosed) {
        const curve = worry > 0.2 ? -4.5 : relief > 0.2 ? 6.2 : 3.6;
        dom.mouthClosed.setAttribute('d', buildClosedMouthPath(m.mouth.ox, m.mouth.oy, m.mouth.w, curve));
        dom.mouthClosed.setAttribute('opacity', joy > 0.5 ? '0' : '1');
      }
      if (dom.mouthOpen) {
        dom.mouthOpen.setAttribute('opacity', joy > 0.5 ? '1' : '0');
      }
      if (dom.blush) {
        dom.blush.setAttribute('opacity', joy > 0.5 ? '0.9' : relief > 0.2 ? '0.45' : '0');
      }
      if (dom.sweat) {
        dom.sweat.setAttribute('opacity', worry > 0.2 ? '0.9' : '0');
        dom.sweat.setAttribute('transform', sweatAt(m.sweatOffset.ox, m.sweatOffset.oy, 0.88));
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
      sky: createMemberPhysics(CREW[0]!),
      gold: createMemberPhysics(CREW[1]!),
      cobalt: createMemberPhysics(CREW[2]!),
      pink: createMemberPhysics(CREW[3]!),
      mint: createMemberPhysics(CREW[4]!),
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

      // 4. Update each of the 5 crew members
      CREW.forEach((m) => {
        const dom = memberRefs.current[m.id];
        if (!dom.root) return;
        const p = physics[m.id];

        // Trigger 3 staggered squash-and-stretch celebration hops (0.07s stagger)
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

        // Gaze direction vector from this character's anchor toward the card focus
        const dx = clamp(lookX - m.anchorX * 0.42, -1.2, 1.2);
        const dy = clamp(lookY - m.anchorY * 0.36, -1.2, 1.2);

        const leanTarget = clamp(dx * 5, -5, 5);
        const leanDeg = step(p.lean, leanTarget, dt);

        const turnX = step(p.turnX, dx * 6.2, dt);
        const turnY = step(p.turnY, dy * 3.8, dt);

        // Subtle organic idle bobbing
        const bob = Math.sin(elapsed * m.bobSpeed + m.bobPhase) * 2.1;
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

        const eyeWiden = 1 + worry * 0.1;
        const pupilShrink = lerp(1, 0.72, clamp(worry, 0, 1));
        const showHappy = joy > 0.48;

        m.eyes.forEach((eye, i) => {
          const maxTravel = Math.max(1.5, eye.r - eye.pr - 1.4);
          const dist = Math.hypot(dx, dy) || 1;
          const clampedMag = Math.min(1, dist);
          const pTargetX = (dx / dist) * clampedMag * maxTravel;
          const pTargetY = (dy / dist) * clampedMag * maxTravel;

          const px = step(p.pupilX[i]!, pTargetX, dt);
          const py = step(p.pupilY[i]!, pTargetY, dt);
          // Clamp final googly pupil inside eye white
          const pDist = Math.hypot(px, py);
          const fpx = pDist > maxTravel ? (px / pDist) * maxTravel : px;
          const fpy = pDist > maxTravel ? (py / pDist) * maxTravel : py;

          const eg = dom.eyeGroups[i];
          const pup = dom.pupils[i];
          const lid = dom.lids[i];
          const hap = dom.happyEyes[i];
          const brow = dom.brows[i];

          if (eg) {
            eg.setAttribute('opacity', showHappy ? '0' : '1');
            eg.setAttribute(
              'transform',
              `translate(${eye.ox.toFixed(2)},${eye.oy.toFixed(2)}) scale(${eyeWiden.toFixed(3)})`
            );
          }

          if (pup) {
            pup.setAttribute(
              'transform',
              `translate(${fpx.toFixed(2)},${fpy.toFixed(2)}) scale(${pupilShrink.toFixed(3)})`
            );
          }

          if (lid) {
            // Eyelid drops 30% of eye diameter (0.6 * r) down from top edge on worry
            const drop = clamp(worry, 0, 1) * (eye.r * 0.62);
            const lidHeight = eye.r * 2.1;
            const lidY = -eye.r - lidHeight + drop;
            lid.setAttribute('y', lidY.toFixed(2));
          }

          if (hap) {
            hap.setAttribute('opacity', showHappy ? clamp((joy - 0.4) * 2.2, 0, 1).toFixed(3) : '0');
          }

          if (brow) {
            const side: -1 | 1 = m.eyes.length === 1 ? (dx >= 0 ? -1 : 1) : i === 0 ? -1 : 1;
            brow.setAttribute('d', browPath(eye.ox, eye.oy, eye.r, side, clamp(worry, 0, 1)));
            brow.setAttribute('opacity', clamp(worry * 1.15, 0, 1).toFixed(3));
          }
        });

        // Mouth: neutral / relief smile / worried frown -> open joy grin + pink tongue
        if (dom.mouthClosed) {
          const baseCurve = 3.6 + relief * 3.2 - worry * 9.5;
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

        // Blush strokes on joy & relief
        if (dom.blush) {
          const blushOp = clamp(joy * 0.9 + relief * 0.42, 0, 0.95);
          dom.blush.setAttribute('opacity', blushOp.toFixed(3));
        }

        // Sweat drop slides downward while worried
        if (dom.sweat) {
          const wOp = clamp(worry * 1.1, 0, 0.95);
          const slide = eio((elapsed * 0.95 + m.bobPhase) % 1) * 9.5;
          dom.sweat.setAttribute('opacity', wOp.toFixed(3));
          dom.sweat.setAttribute(
            'transform',
            sweatAt(m.sweatOffset.ox, m.sweatOffset.oy + slide, 0.72 + worry * 0.22)
          );
        }

        // Floating heart during joy celebration
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

      // 5. Back-layer sparkles twinkle & burst bigger during joy celebration
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
          <radialGradient id={gradId} cx="35%" cy="28%" r="72%">
            <stop offset="0%" stopColor={m.highlight} />
            <stop offset="100%" stopColor={m.color} />
          </radialGradient>
          {m.eyes.map((eye, idx) => (
            <clipPath key={idx} id={`${uid}-eyeclip-${m.id}-${idx}`}>
              <circle cx="0" cy="0" r={eye.r} />
            </clipPath>
          ))}
        </defs>

        {/* Polar body silhouette */}
        <path
          d={m.bodyPath}
          fill={`url(#${gradId})`}
          stroke={`rgba(${INK_RGB},0.16)`}
          strokeWidth="1.5"
        />

        {/* Face group with 3D turn slide */}
        <g
          ref={(el) => {
            memberRefs.current[m.id].face = el;
          }}
        >
          {/* Open googly eyes */}
          {m.eyes.map((eye, idx) => (
            <g
              key={`eye-${idx}`}
              ref={(el) => {
                memberRefs.current[m.id].eyeGroups[idx] = el;
              }}
              transform={`translate(${eye.ox},${eye.oy})`}
            >
              <circle
                cx="0"
                cy="0"
                r={eye.r}
                fill={EYE_WHITE}
                stroke={INK}
                strokeWidth="1.5"
              />
              <g clipPath={`url(#${uid}-eyeclip-${m.id}-${idx})`}>
                <g
                  ref={(el) => {
                    memberRefs.current[m.id].pupils[idx] = el;
                  }}
                >
                  <circle cx="0" cy="0" r={eye.pr} fill={INK} />
                  <circle
                    cx={-eye.pr * 0.34}
                    cy={-eye.pr * 0.34}
                    r={Math.max(1.4, eye.pr * 0.32)}
                    fill={EYE_WHITE}
                  />
                </g>
                {/* Eyelid dropping over eye on worry */}
                <rect
                  ref={(el) => {
                    memberRefs.current[m.id].lids[idx] = el;
                  }}
                  x={-eye.r - 2}
                  y={-eye.r * 3.1}
                  width={eye.r * 2 + 4}
                  height={eye.r * 2.1}
                  fill={m.color}
                  stroke={INK}
                  strokeWidth="1.4"
                />
              </g>
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

          {/* Worried inward-tilted brows */}
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

          {/* Closed expressive mouth (neutral / relief / worried frown) */}
          <path
            ref={(el) => {
              memberRefs.current[m.id].mouthClosed = el;
            }}
            d={buildClosedMouthPath(m.mouth.ox, m.mouth.oy, m.mouth.w, 3.6)}
            fill="none"
            stroke={INK}
            strokeWidth="2.4"
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

        {/* Worry sweat drop */}
        <path
          ref={(el) => {
            memberRefs.current[m.id].sweat = el;
          }}
          d={SWEAT_PATH}
          fill="#60A5FA"
          stroke={INK}
          strokeWidth="1.2"
          opacity="0"
          transform={sweatAt(m.sweatOffset.ox, m.sweatOffset.oy, 0.8)}
        />

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
      className="-mx-5 -my-5 sm:-mx-8 sm:-my-8 px-4 pt-4 pb-6 sm:px-6 sm:pt-5 sm:pb-7 bg-gradient-to-b from-[#DCE8F8] via-[#EAEFF6] to-[#E6EFFA] font-sans relative"
      style={{ fontFamily: "'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between gap-2 mb-1 relative z-20">
        <button
          type="button"
          onClick={onBack}
          disabled={isVerifying}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-[#111827] bg-white/85 backdrop-blur-md border border-white/90 shadow-xs hover:bg-white active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
        >
          <ArrowLeft className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
          <span>Voltar</span>
        </button>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-md text-[#1E3A8A] border border-white/90 shadow-xs shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
          <span>Gov.br Gate</span>
        </span>
      </div>

      {/* Interactive Crew Stage: Back Layer + Frosted Card + Front Layer */}
      <div
        ref={cardRef}
        onPointerMove={handleCardPointerMove}
        onPointerLeave={handleCardPointerLeave}
        className="relative"
      >
        {/* BACK SVG LAYER: Sparkles + Sky, Gold, Cobalt peeking over the top edge of the card */}
        <div className="relative z-0 -mb-7 pointer-events-none select-none" aria-hidden="true">
          <svg
            viewBox="0 0 400 132"
            className="w-full h-auto block overflow-visible"
            role="presentation"
          >
            {/* Ambient sparkle stars */}
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
            {BACK_CREW.map(renderCrewMember)}
          </svg>
        </div>

        {/* FROSTED SIGN-UP CARD */}
        <div className="relative z-10 rounded-[28px] bg-white/88 backdrop-blur-xl border border-white/90 shadow-[0_18px_46px_rgba(15,23,42,0.09)] px-4 pt-5 pb-7 sm:px-6 sm:pt-6 sm:pb-8">
          {/* Header & Dynamic Crew Subtitle */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] text-[11px] font-semibold text-[#1D4ED8] mb-2">
              <LockOpen className="w-3 h-3 text-[#10B981]" aria-hidden="true" />
              <span>Acesso ao trajeto {corridorLabel}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111827]">
              Validação única Gov.br
            </h2>
            <p
              className={`text-xs sm:text-sm mt-1 transition-colors ${
                error ? 'text-[#D70015] font-medium' : 'text-[#4B5563]'
              }`}
            >
              {error
                ? 'Ops! A turma notou algo para corrigir'
                : 'Identificação institucional segura para caminhar com colegas verificados'}
            </p>
          </div>

          {/* GPS Pre-Permission Row */}
          <div className="p-3 rounded-2xl bg-[#F8FAFC]/90 border border-[#E5EAF4]">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs text-[#4B5563] leading-relaxed">
                <span className="font-semibold text-[#111827] block">
                  Localização no campus
                </span>
                Usamos sua posição apenas enquanto caminha na UFSC para alertar sobre trechos escuros.
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onRequestGps}
                className="min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-[#E5EAF4] text-[#2563EB] hover:bg-[#EFF6FF] active:scale-[0.97] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                Continuar para localização
              </button>
              {gpsStatus !== 'prompt' && (
                <span className="text-xs font-medium text-[#059669] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{gpsStatus === 'granted' ? 'Habilitada' : 'Campus Trindade'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Gov.br Form */}
          <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
            {/* Nome completo */}
            <div
              ref={(el) => {
                fieldWrapRefs.current.name = el;
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="govbr-name"
                  className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider"
                >
                  Nome completo
                </label>
                <button
                  type="button"
                  onClick={onAutofillDemo}
                  disabled={isVerifying}
                  className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#2563EB] font-semibold hover:underline cursor-pointer rounded-full disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
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
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border bg-white/95 text-sm text-[#111827] transition-colors focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                  error && errorField === 'name'
                    ? 'border-[#EF4444] bg-red-50/40'
                    : 'border-[#DCE3F0]'
                }`}
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
                className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1"
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
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border bg-white/95 text-sm text-[#111827] transition-colors focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                  error && errorField === 'affiliation'
                    ? 'border-[#EF4444] bg-red-50/40'
                    : 'border-[#DCE3F0]'
                }`}
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
                  className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider"
                >
                  CPF
                </label>
                {maskedPreview && (
                  <span className="text-[11px] font-medium text-[#059669]">
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
                  className={`w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl border bg-white/95 text-sm text-[#111827] transition-colors focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                    error && errorField === 'cpf'
                      ? 'border-[#EF4444] bg-red-50/40'
                      : isCpfValid
                        ? 'border-[#22C55E] bg-[#F0FDF4]/60'
                        : 'border-[#DCE3F0]'
                  }`}
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
                className="t-error-msg p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#D70015] font-medium"
              >
                {error}
              </div>
            )}

            {/* 3-Stage Verification Checklist */}
            {isVerifying && (
              <div className="p-3.5 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] space-y-2">
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
                            ? `text-[#111827] ${item.strong ? 'font-semibold' : 'font-medium'}`
                            : 'text-[#4B5563]'
                        }
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submit / Celebration CTA */}
            <div className="pt-1.5 pb-1">
              <button
                type="submit"
                disabled={isVerifying}
                className={`w-full min-h-[48px] px-5 py-3 rounded-full text-sm font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                  isSuccess
                    ? 'bg-[#22C55E] text-white shadow-[0_8px_22px_rgba(34,197,94,0.35)]'
                    : 'bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]'
                }`}
              >
                {isSuccess ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                    <span>Tudo certo!</span>
                  </>
                ) : (
                  <span>Validar e entrar →</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* FRONT SVG LAYER: Pink & Mint peeking over the bottom corners of the frosted card */}
        <div className="relative z-20 -mt-9 pointer-events-none select-none" aria-hidden="true">
          <svg
            viewBox="0 0 400 84"
            className="w-full h-auto block overflow-visible"
            role="presentation"
          >
            {FRONT_CREW.map(renderCrewMember)}
          </svg>
        </div>
      </div>
    </div>
  );
};
