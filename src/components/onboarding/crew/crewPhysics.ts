/**
 * Oglet-inspired spring physics and WelcomeBack Trio (Blue, Gold, Pink) data.
 * Pure math + static SVG geometry so the 60fps rAF loop stays allocation-light and zero-React-setState.
 */

export const INK = '#0F172A';
export const INK_RGB = '15,23,42';
export const TONGUE = '#FF6B8A';

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function eio(t: number): number {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/**
 * Samples a polar radius function r(theta) into a closed SVG path string centered at (0, 0).
 */
export function polar(f: (theta: number) => number, N = 96): string {
  const parts: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = f(a);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function ovalRadius(rx: number, ry: number): (theta: number) => number {
  return (a: number) => 1 / Math.hypot(Math.cos(a) / rx, Math.sin(a) / ry);
}

export interface Spring {
  x: number;
  v: number;
  k: number;
  c: number;
}

export function spring(k: number, c: number, initial = 0): Spring {
  return { x: initial, v: 0, k, c };
}

export function step(s: Spring, target: number, dt: number): number {
  const h = Math.min(Math.max(dt, 0), 0.05);
  const a = s.k * (target - s.x) - s.c * s.v;
  s.v += a * h;
  s.x += s.v * h;
  return s.x;
}

export const SPRINGS = {
  worry: [140, 20] as const,
  joy: [260, 30] as const,
  relief: [90, 17] as const,
  hop: [230, 14] as const,
  lean: [70, 13] as const,
  shake: [300, 10] as const,
  squash: [360, 17] as const,
  turn: [80, 14] as const,
  eye: [140, 11] as const,
} as const;

export type CrewId = 'blue' | 'gold' | 'pink';

export interface CrewEyeSpec {
  ox: number;
  oy: number;
  r: number;
  /** Friendly dark capsule/slanted eye silhouette path centered at (0, 0) */
  path: string;
  /** 4-point sparkle accent nested inside the eye */
  sparkle: { ox: number; oy: number; r: number };
}

export interface CrewMember {
  id: CrewId;
  name: string;
  color: string;
  highlight: string;
  haloColor: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Approximate anchor in normalized [-1, 1] card-relative space for realistic gaze convergence */
  anchorX: number;
  anchorY: number;
  baseTilt: number;
  bodyPath: string;
  eyes: CrewEyeSpec[];
  mouth: { ox: number; oy: number; w: number };
  blush: Array<{ ox: number; oy: number }>;
  freckles?: Array<{ ox: number; oy: number; r: number }>;
  heartOffset: { ox: number; oy: number };
  hopDelay: number;
  shakeSign: 1 | -1;
  bobPhase: number;
  bobSpeed: number;
}

export const CREW: readonly CrewMember[] = [
  {
    id: 'blue',
    name: 'Gotinha Azul',
    color: '#5EC2F3',
    highlight: '#87D7FA',
    haloColor: 'rgba(135, 215, 250, 0.55)',
    cx: 112,
    cy: 88,
    rx: 48,
    ry: 58,
    anchorX: -0.52,
    anchorY: -1.05,
    baseTilt: -7,
    bodyPath: polar(ovalRadius(48, 58), 96),
    eyes: [
      {
        ox: -13,
        oy: -13,
        r: 9.4,
        path: 'M-8.2,-1.8 C-5.0,-8.2 4.8,-8.4 8.0,-1.2 C9.2,4.2 3.8,8.0 -2.2,6.8 C-7.2,5.8 -9.8,1.8 -8.2,-1.8 Z',
        sparkle: { ox: 3.4, oy: -2.8, r: 3.4 },
      },
      {
        ox: 14,
        oy: -6,
        r: 9.8,
        path: 'M-7.8,-2.8 C-4.2,-8.8 5.6,-7.8 8.2,-1.0 C9.2,4.8 3.2,8.8 -2.8,7.4 C-7.8,6.2 -9.6,1.6 -7.8,-2.8 Z',
        sparkle: { ox: 3.6, oy: -2.8, r: 3.2 },
      },
    ],
    mouth: { ox: 1, oy: 11, w: 12 },
    blush: [
      { ox: -22, oy: 2 },
      { ox: 24, oy: 6 },
    ],
    freckles: [
      { ox: -6, oy: 2, r: 1.7 },
      { ox: 4, oy: 5, r: 1.4 },
      { ox: -12, oy: 6, r: 1.3 },
    ],
    heartOffset: { ox: -28, oy: -48 },
    hopDelay: 0,
    shakeSign: 1,
    bobPhase: 0.2,
    bobSpeed: 2.1,
  },
  {
    id: 'gold',
    name: 'Gotinha Solar',
    color: '#F7C648',
    highlight: '#FFE270',
    haloColor: 'rgba(255, 226, 112, 0.6)',
    cx: 200,
    cy: 84,
    rx: 64,
    ry: 54,
    anchorX: 0,
    anchorY: -1.12,
    baseTilt: 0,
    bodyPath: polar(ovalRadius(64, 54), 96),
    eyes: [
      {
        ox: -17,
        oy: -10,
        r: 9.4,
        path: 'M-5.4,-7.4 C-2.0,-9.4 2.0,-9.4 5.4,-7.4 C7.4,-3.8 7.4,3.8 5.4,7.4 C2.0,9.4 -2.0,9.4 -5.4,7.4 C-7.4,3.8 -7.4,-3.8 -5.4,-7.4 Z',
        sparkle: { ox: 2.2, oy: -3.2, r: 2.6 },
      },
      {
        ox: 17,
        oy: -10,
        r: 9.4,
        path: 'M-5.4,-7.4 C-2.0,-9.4 2.0,-9.4 5.4,-7.4 C7.4,-3.8 7.4,3.8 5.4,7.4 C2.0,9.4 -2.0,9.4 -5.4,7.4 C-7.4,3.8 -7.4,-3.8 -5.4,-7.4 Z',
        sparkle: { ox: 2.2, oy: -3.2, r: 2.6 },
      },
    ],
    mouth: { ox: 0, oy: 11, w: 16 },
    blush: [
      { ox: -29, oy: 4 },
      { ox: 29, oy: 4 },
    ],
    heartOffset: { ox: 0, oy: -52 },
    hopDelay: 0.08,
    shakeSign: -1,
    bobPhase: 1.4,
    bobSpeed: 2.3,
  },
  {
    id: 'pink',
    name: 'Gotinha Rosa',
    color: '#EE86BF',
    highlight: '#F5A4CE',
    haloColor: 'rgba(245, 164, 206, 0.55)',
    cx: 288,
    cy: 88,
    rx: 48,
    ry: 58,
    anchorX: 0.52,
    anchorY: -1.05,
    baseTilt: 7,
    bodyPath: polar(ovalRadius(48, 58), 96),
    eyes: [
      {
        ox: -14,
        oy: -6,
        r: 9.8,
        path: 'M-8.2,-1.0 C-5.6,-7.8 4.2,-8.8 7.8,-2.8 C9.6,1.6 7.8,6.2 2.8,7.4 C-3.2,8.8 -9.2,4.8 -8.2,-1.0 Z',
        sparkle: { ox: 2.6, oy: -2.8, r: 2.8 },
      },
      {
        ox: 13,
        oy: -13,
        r: 9.4,
        path: 'M-8.0,-1.2 C-4.8,-8.4 5.0,-8.2 8.2,-1.8 C9.8,1.8 7.2,5.8 2.2,6.8 C-3.8,8.0 -9.2,4.2 -8.0,-1.2 Z',
        sparkle: { ox: 2.6, oy: -2.8, r: 2.8 },
      },
    ],
    mouth: { ox: -1, oy: 11, w: 12 },
    blush: [
      { ox: -24, oy: 6 },
      { ox: 22, oy: 2 },
    ],
    heartOffset: { ox: 28, oy: -48 },
    hopDelay: 0.16,
    shakeSign: 1,
    bobPhase: 2.5,
    bobSpeed: 2.0,
  },
] as const;

export interface StarSpec {
  x: number;
  y: number;
  r: number;
  phase: number;
  color: string;
}

export const STARS: readonly StarSpec[] = [
  { x: 46, y: 28, r: 5.4, phase: 0.0, color: '#87D7FA' },
  { x: 152, y: 18, r: 4.4, phase: 1.1, color: '#FFE270' },
  { x: 248, y: 18, r: 4.6, phase: 2.3, color: '#F5A4CE' },
  { x: 354, y: 30, r: 5.6, phase: 3.4, color: '#5EC2F3' },
  { x: 200, y: 10, r: 3.8, phase: 4.5, color: '#FFFFFF' },
] as const;

/** Cute celebration heart path centered at (0, 0) */
export const HEART_PATH =
  'M0,6.5 C-0.6,5.9 -7.2,1.2 -7.2,-2.6 C-7.2,-5.4 -5.0,-7.4 -2.5,-7.4 C-1.0,-7.4 0,-6.4 0,-5.3 C0,-6.4 1.0,-7.4 2.5,-7.4 C5.0,-7.4 7.2,-5.4 7.2,-2.6 C7.2,1.2 0.6,5.9 0,6.5 Z';

/** Transform string placing a floating heart at (x, y) with optional scale and rotation */
export function heartAt(x: number, y: number, scale = 1, rotDeg = 0): string {
  return `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${rotDeg.toFixed(1)}) scale(${scale.toFixed(3)})`;
}

/** Three tiny rosy blush strokes around (cx, cy) */
export function blushPath(cx: number, cy: number, r = 5.5): string {
  const s = r * 0.65;
  const h = r * 0.45;
  return [
    `M${(cx - s).toFixed(2)},${(cy + h).toFixed(2)} L${(cx - s + 2.2).toFixed(2)},${(cy - h).toFixed(2)}`,
    `M${(cx - 1.1).toFixed(2)},${(cy + h).toFixed(2)} L${(cx + 1.1).toFixed(2)},${(cy - h).toFixed(2)}`,
    `M${(cx + s - 2.2).toFixed(2)},${(cy + h).toFixed(2)} L${(cx + s).toFixed(2)},${(cy - h).toFixed(2)}`,
  ].join(' ');
}

/** Joyful ^ eye arc path */
export function happyPath(cx: number, cy: number, r: number): string {
  const w = r * 0.78;
  const h = r * 0.68;
  return `M${(cx - w).toFixed(2)},${(cy + r * 0.16).toFixed(2)} Q${cx.toFixed(2)},${(cy - h).toFixed(2)} ${(cx + w).toFixed(2)},${(cy + r * 0.16).toFixed(2)}`;
}

/** Worried brow segment tilting inward as worry increases (side: -1 left, 1 right) */
export function browPath(
  cx: number,
  cy: number,
  r: number,
  side: -1 | 1,
  worry: number
): string {
  const w = r * 0.72;
  const baseY = cy - r - 2.8;
  const tilt = worry * 3.8;
  const x1 = cx - w;
  const x2 = cx + w;
  const y1 = baseY + (side === -1 ? tilt : -tilt * 0.55);
  const y2 = baseY + (side === 1 ? tilt : -tilt * 0.55);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}`;
}

/** Four-point sparkle star centered at (cx, cy) with outer radius r */
export function starPath(cx: number, cy: number, r: number): string {
  const inner = r * 0.28;
  return [
    `M${cx.toFixed(2)},${(cy - r).toFixed(2)}`,
    `Q${(cx + inner * 0.35).toFixed(2)},${(cy - inner * 0.35).toFixed(2)} ${(cx + r).toFixed(2)},${cy.toFixed(2)}`,
    `Q${(cx + inner * 0.35).toFixed(2)},${(cy + inner * 0.35).toFixed(2)} ${cx.toFixed(2)},${(cy + r).toFixed(2)}`,
    `Q${(cx - inner * 0.35).toFixed(2)},${(cy + inner * 0.35).toFixed(2)} ${(cx - r).toFixed(2)},${cy.toFixed(2)}`,
    `Q${(cx - inner * 0.35).toFixed(2)},${(cy - inner * 0.35).toFixed(2)} ${cx.toFixed(2)},${(cy - r).toFixed(2)}`,
    'Z',
  ].join(' ');
}
