import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { BotEngine, type BotFrame } from '../../mascot/bloub/engine';
import { EXPRESSION_BY_ID, type ExpressionId } from '../../mascot/bloub/expressions';
import { PITCH, PITCH_MAX, TURN_TIME, YAW_MAX } from '../../mascot/bloub/gaze';
import { clamp } from '../../mascot/bloub/math';
import { DEMI_VIEWBOX, RAYON } from '../../mascot/bloub/repere';
import { SHAPE_BY_ID, mixHex, type ShapeId } from '../../mascot/bloub/skins';
import { POSES, STATE_BY_ID, type StateId } from '../../mascot/bloub/states';

export const DROPLET_ALL_STATES: StateId[] = [
  'idle',
  'thinking',
  'wink',
  'wide',
  'alert',
  'notify',
  'exclaim',
  'sleep',
  'egg',
  'hexagon',
  'play',
  'orbit',
  'swirl',
  'burst',
  'comet',
];

export interface DropletMascotProps {
  state?: StateId;
  expression?: ExpressionId;
  shape?: ShapeId;
  size?: number;
  inkColor?: string;
  paperColor?: string;
  notifColor?: string;
  follow?: boolean;
  interactive?: boolean;
  tremble?: boolean;
  frozenAt?: number;
  ariaLabel?: string;
  className?: string;
  onStateCycle?: (nextState: StateId) => void;
  onTap?: () => void;
}

const VB = DEMI_VIEWBOX;

function normalizeHex(color: string): string | null {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1]!;
    const g = trimmed[2]!;
    const b = trimmed[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

function resolveDotFill(
  dot: BotFrame['dots'][number],
  inkColor: string,
  paperColor: string
): string {
  if (dot.color) return dot.color;
  if (dot.depth === undefined) return inkColor;
  const normPaper = normalizeHex(paperColor);
  const normInk = normalizeHex(inkColor);
  return normPaper && normInk ? mixHex(normPaper, normInk, dot.depth) : inkColor;
}

function renderDot(
  dot: BotFrame['dots'][number],
  key: string,
  inkColor: string,
  paperColor: string
): React.ReactNode {
  const fill = resolveDotFill(dot, inkColor, paperColor);
  if (dot.d) {
    return (
      <path
        key={key}
        d={dot.d}
        transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`}
        fill={fill}
        opacity={dot.opacity}
      />
    );
  }
  return <circle key={key} cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />;
}

/**
 * Pure SVG mascot driven by the MIT bloub procedural engine, defaulting to RuaEscura's
 * droplet silhouette ('goutte'), friendly expression ('heureux'), and campus palette.
 */
export const DropletMascot: React.FC<DropletMascotProps> = ({
  state: controlledState,
  expression = 'heureux',
  shape = 'goutte',
  size = 88,
  inkColor = '#2563EB',
  paperColor = '#FFFFFF',
  notifColor = '#10B981',
  follow = true,
  interactive = false,
  tremble = false,
  frozenAt,
  ariaLabel = 'Mascote RuaEscura',
  className = '',
  onStateCycle,
  onTap,
}) => {
  const isControlled = controlledState !== undefined;
  const [uncontrolledState, setUncontrolledState] = useState<StateId>('idle');
  const activeState: StateId = isControlled ? controlledState : uncontrolledState;

  const prefersReducedMotion = usePrefersReducedMotion();
  const isStatic = frozenAt !== undefined || prefersReducedMotion;

  const shapeRadii = useMemo(() => SHAPE_BY_ID.get(shape)?.radii ?? null, [shape]);
  const expressionObj = useMemo(() => EXPRESSION_BY_ID.get(expression) ?? null, [expression]);

  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '') || 'droplet';
  const maskId = `${uid}-mask`;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const engineRef = useRef<BotEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BotEngine(RAYON, activeState, shapeRadii, expressionObj);
  }

  const clockRef = useRef<number>(0);
  const lastMsRef = useRef<number>(0);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const aimingRef = useRef<boolean>(false);
  const activeStateRef = useRef<StateId>(activeState);
  activeStateRef.current = activeState;
  const followRef = useRef<boolean>(follow);
  followRef.current = follow;
  const wasStaticRef = useRef<boolean>(isStatic);

  const [liveFrame, setLiveFrame] = useState<BotFrame>(() => engineRef.current!.sample(0));
  const [isPulsing, setIsPulsing] = useState<boolean>(false);
  const pulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  const staticFrame = useMemo<BotFrame | null>(() => {
    if (!isStatic) return null;
    const snapshotEngine = new BotEngine(RAYON, activeState, shapeRadii, expressionObj);
    const snapshotTime = frozenAt !== undefined ? frozenAt : POSES[activeState];
    return snapshotEngine.sample(snapshotTime);
  }, [isStatic, activeState, shapeRadii, expressionObj, frozenAt]);

  // Live RAF animation loop (disabled whenever frozenAt or prefers-reduced-motion is active)
  useEffect(() => {
    const wasStatic = wasStaticRef.current;
    wasStaticRef.current = isStatic;
    if (isStatic) return;

    const engine = engineRef.current!;
    if (wasStatic) {
      engine.reset(activeStateRef.current, clockRef.current);
      setLiveFrame(engine.sample(clockRef.current));
    }

    let rafId = 0;

    const updateAim = (clock: number) => {
      const pointer = pointerRef.current;
      if (!followRef.current || !pointer || !STATE_BY_ID.get(activeStateRef.current)?.baseFace) {
        if (aimingRef.current) {
          engine.setLook(null, clock, TURN_TIME);
          aimingRef.current = false;
        }
        return;
      }
      const box = svgRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;

      const halfWidth = Math.max(1, window.innerWidth / 2);
      const halfHeight = Math.max(1, window.innerHeight / 2);
      const nx = clamp((pointer.x - (box.left + box.width / 2)) / halfWidth, -1, 1);
      const ny = clamp((pointer.y - (box.top + box.height / 2)) / halfHeight, -1, 1);

      engine.setLook(
        {
          yaw: nx * YAW_MAX,
          pitch: PITCH - ny * PITCH_MAX,
          mix: 1,
          spin: 0,
          wander: 0,
        },
        clock
      );
      aimingRef.current = true;
    };

    const tick = (ms: number) => {
      const dt = lastMsRef.current ? Math.min((ms - lastMsRef.current) / 1000, 0.064) : 0;
      lastMsRef.current = ms;
      clockRef.current += dt;

      updateAim(clockRef.current);
      setLiveFrame(engine.sample(clockRef.current));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      lastMsRef.current = 0;
    };
  }, [isStatic]);

  // Smooth morph on dynamic state prop changes in live mode
  useEffect(() => {
    if (isStatic) return;
    engineRef.current?.setState(activeState, clockRef.current);
  }, [activeState, isStatic]);

  // Smooth morph on dynamic shape changes in live mode
  useEffect(() => {
    if (isStatic) return;
    engineRef.current?.setShape(shapeRadii, clockRef.current);
  }, [shapeRadii, isStatic]);

  // Smooth morph on dynamic expression changes in live mode
  useEffect(() => {
    if (isStatic) return;
    engineRef.current?.setExpression(expressionObj, clockRef.current);
  }, [expressionObj, isStatic]);

  // Desktop / non-touch pointer tracking
  useEffect(() => {
    if (!follow || isStatic) {
      pointerRef.current = null;
      if (aimingRef.current && engineRef.current) {
        engineRef.current.setLook(null, clockRef.current, TURN_TIME);
        aimingRef.current = false;
      }
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerLeave = () => {
      pointerRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerleave', onPointerLeave);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      pointerRef.current = null;
    };
  }, [follow, isStatic]);

  const isInteractive = Boolean(interactive || onTap);

  const handleInteraction = useCallback(() => {
    const currentIndex = DROPLET_ALL_STATES.indexOf(activeState);
    const nextState =
      DROPLET_ALL_STATES[(currentIndex + 1) % DROPLET_ALL_STATES.length] ?? 'idle';

    if (!isControlled) {
      setUncontrolledState(nextState);
    }

    if (!prefersReducedMotion) {
      setIsPulsing(true);
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }
      pulseTimerRef.current = window.setTimeout(() => {
        setIsPulsing(false);
        pulseTimerRef.current = null;
      }, 180);
    }

    onStateCycle?.(nextState);
    onTap?.();
  }, [activeState, isControlled, prefersReducedMotion, onStateCycle, onTap]);

  const frame = staticFrame ?? liveFrame;

  const trembleClass = tremble && !prefersReducedMotion ? 'droplet-tremble' : '';

  const svgElement = (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
      role="img"
      aria-label={ariaLabel}
      data-state={activeState}
      data-shape={shape}
      data-expression={expression}
      data-tremble={tremble ? 'true' : 'false'}
      className={`${isInteractive ? 'block shrink-0' : className || ''} ${trembleClass}`.trim() || undefined}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-VB} y={-VB} width={VB * 2} height={VB * 2}>
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, i) => (
            <path key={i} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
          ))}
          {frame.notch && (
            <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />
          )}
        </mask>

        {frame.arcs.map((arc) => {
          const stopCount = arc.grad.stops.length;
          return (
            <linearGradient
              key={arc.id}
              id={`${uid}-${arc.id}`}
              gradientUnits="userSpaceOnUse"
              x1={arc.grad.x1}
              y1={arc.grad.y1}
              x2={arc.grad.x2}
              y2={arc.grad.y2}
            >
              {arc.grad.stops.map((color, i) => (
                <stop
                  key={i}
                  offset={stopCount > 1 ? i / (stopCount - 1) : 0}
                  stopColor={color}
                />
              ))}
            </linearGradient>
          );
        })}
      </defs>

      {/* Back half of 3D orbit/comet arcs: drawn before body so body occludes them */}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) =>
          arc.back ? (
            <path
              key={`b${arc.id}`}
              d={arc.back}
              stroke={`url(#${uid}-${arc.id})`}
              strokeWidth={arc.width}
              opacity={arc.opacity}
            />
          ) : null
        )}
      </g>

      {/* Burst particles passing behind the core */}
      {frame.dotsBehind && (
        <g>{frame.dots.map((dot, i) => renderDot(dot, `pb${i}`, inkColor, paperColor))}</g>
      )}

      {/* Opaque paper backing + ink body punched out by eye/notch mask */}
      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={paperColor} />
        <g mask={`url(#${maskId})`}>
          <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={inkColor} />
        </g>
      </g>

      {/* Foreground dots (thinking dots, exclamation points) */}
      {!frame.dotsBehind && (
        <g>{frame.dots.map((dot, i) => renderDot(dot, `pf${i}`, inkColor, paperColor))}</g>
      )}

      {/* Notification dot in RuaEscura accent color */}
      {frame.notif && (
        <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={notifColor} />
      )}

      {/* Front half of 3D orbit/comet arcs */}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) =>
          arc.front ? (
            <path
              key={`f${arc.id}`}
              d={arc.front}
              stroke={`url(#${uid}-${arc.id})`}
              strokeWidth={arc.width}
              opacity={arc.opacity}
            />
          ) : null
        )}
      </g>
    </svg>
  );

  if (!isInteractive) {
    return svgElement;
  }

  return (
    <button
      type="button"
      onClick={handleInteraction}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full bg-transparent border-0 p-0 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD] ${
        prefersReducedMotion
          ? ''
          : `transition-transform duration-150 ease-out active:scale-95 ${
              isPulsing ? 'scale-105' : 'scale-100'
            }`
      } ${className}`}
    >
      {svgElement}
    </button>
  );
};
