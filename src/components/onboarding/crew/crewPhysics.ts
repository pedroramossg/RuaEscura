/**
 * Oglet-inspired spring physics, polar silhouettes, and Rua Escura 5-character Crew data.
 * Pure math + static SVG geometry so the 60fps rAF loop stays allocation-light and zero-React-setState.
 */

export const INK = '#15121C';
export const INK_RGB = '21,18,28';
export const EYE_WHITE = '#FFFFFF';
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
  pupil: [140, 8.5] as const,
} as const;

export type CrewId = 'sky' | 'cobalt' | 'gold' | 'pink' | 'mint';

export interface CrewEyeSpec {
  ox: number;
  oy: number;
  r: number;
  pr: number;
}

export interface CrewMember {
  id: CrewId;
  name: string;
  layer: 'back' | 'front';
  color: string;
  highlight: string;
  cx: number;
  cy: number;
  /** Approximate anchor in normalized [-1, 1] card-relative space for realistic gaze convergence */
  anchorX: number;
  anchorY: number;
  baseTilt: number;
  bodyPath: string;
  eyes: CrewEyeSpec[];
  mouth: { ox: number; oy: number; w: number };
  blush: Array<{ ox: number; oy: number }>;
  sweatOffset: { ox: number; oy: number };
  heartOffset: { ox: number; oy: number };
  hopDelay: number;
  shakeSign: 1 | -1;
  bobPhase: number;
  bobSpeed: number;
}

/**
 * Superellipse helper for the tall cobalt capsule bean.
 */
function capsuleRadius(rx: number, ry: number, n: number): (theta: number) => number {
  return (a: number) => {
    const ca = Math.pow(Math.abs(Math.cos(a)) / rx, n);
    const sa = Math.pow(Math.abs(Math.sin(a)) / ry, n);
    return Math.pow(ca + sa, -1 / n);
  };
}

export const CREW: readonly CrewMember[] = [
  {
    id: 'sky',
    name: 'Nuvem',
    layer: 'back',
    color: '#5EC2F3',
    highlight: '#95DCFA',
    cx: 92,
    cy: 98,
    anchorX: -0.58,
    anchorY: -1.05,
    baseTilt: -6,
    // Scalloped cookie / friendly cloud silhouette
    bodyPath: polar((a) => 49 + 5.6 * Math.cos(10 * a) + 1.2 * Math.sin(5 * a), 96),
    eyes: [
      { ox: -15, oy: -12, r: 10.5, pr: 5.1 },
      { ox: 15, oy: -10, r: 10.5, pr: 5.1 },
    ],
    mouth: { ox: 0, oy: 7, w: 12 },
    blush: [
      { ox: -25, oy: 1 },
      { ox: 25, oy: 3 },
    ],
    sweatOffset: { ox: -37, oy: -28 },
    heartOffset: { ox: -34, oy: -48 },
    hopDelay: 0,
    shakeSign: 1,
    bobPhase: 0.2,
    bobSpeed: 2.1,
  },
  {
    id: 'gold',
    name: 'Sol',
    layer: 'back',
    color: '#F7C648',
    highlight: '#FFE285',
    cx: 200,
    cy: 92,
    anchorX: 0,
    anchorY: -1.12,
    baseTilt: 0,
    // Spiky cyclops sun peeking top-center
    bodyPath: polar((a) => 46 + 7.8 * Math.cos(14 * a), 96),
    eyes: [{ ox: 0, oy: -11, r: 15.5, pr: 7.4 }],
    mouth: { ox: 0, oy: 12, w: 13 },
    blush: [
      { ox: -23, oy: 5 },
      { ox: 23, oy: 5 },
    ],
    sweatOffset: { ox: 34, oy: -32 },
    heartOffset: { ox: 0, oy: -54 },
    hopDelay: 0.07,
    shakeSign: -1,
    bobPhase: 1.5,
    bobSpeed: 2.35,
  },
  {
    id: 'cobalt',
    name: 'Farol',
    layer: 'back',
    color: '#2563EB',
    highlight: '#60A5FA',
    cx: 308,
    cy: 102,
    anchorX: 0.58,
    anchorY: -1.05,
    baseTilt: 6,
    // Tall capsule bean peeking top-right
    bodyPath: polar(capsuleRadius(43, 62, 3.4), 96),
    eyes: [
      { ox: -13.5, oy: -17, r: 10.2, pr: 5.0 },
      { ox: 13.5, oy: -17, r: 10.2, pr: 5.0 },
    ],
    mouth: { ox: 0, oy: 2, w: 11.5 },
    blush: [
      { ox: -23, oy: -5 },
      { ox: 23, oy: -5 },
    ],
    sweatOffset: { ox: 34, oy: -38 },
    heartOffset: { ox: 32, oy: -56 },
    hopDelay: 0.14,
    shakeSign: 1,
    bobPhase: 2.8,
    bobSpeed: 1.95,
  },
  {
    id: 'pink',
    name: 'Aura',
    layer: 'front',
    color: '#EE86BF',
    highlight: '#F8B4D9',
    cx: 68,
    cy: 54,
    anchorX: -0.68,
    anchorY: 1.05,
    baseTilt: 5,
    // Lumpy wobble peeking bottom-left
    bodyPath: polar(
      (a) => 40 + 4.4 * Math.sin(3 * a + 0.55) + 2.9 * Math.cos(5 * a - 0.7),
      96
    ),
    eyes: [
      { ox: -12, oy: -8, r: 9.2, pr: 4.5 },
      { ox: 12, oy: -6, r: 9.2, pr: 4.5 },
    ],
    mouth: { ox: 0, oy: 8.5, w: 10.5 },
    blush: [
      { ox: -21, oy: 3 },
      { ox: 21, oy: 4 },
    ],
    sweatOffset: { ox: -31, oy: -22 },
    heartOffset: { ox: -24, oy: -40 },
    hopDelay: 0.21,
    shakeSign: -1,
    bobPhase: 0.9,
    bobSpeed: 2.2,
  },
  {
    id: 'mint',
    name: 'Folha',
    layer: 'front',
    color: '#34D399',
    highlight: '#6EE7B7',
    cx: 332,
    cy: 56,
    anchorX: 0.68,
    anchorY: 1.05,
    baseTilt: -5,
    // Lumpy pebble peeking bottom-right
    bodyPath: polar(
      (a) => 39 + 4.8 * Math.cos(2 * a - 0.45) + 2.6 * Math.sin(4 * a + 1.15),
      96
    ),
    eyes: [
      { ox: -11.5, oy: -7, r: 9.0, pr: 4.4 },
      { ox: 11.5, oy: -8, r: 9.0, pr: 4.4 },
    ],
    mouth: { ox: 0, oy: 8, w: 10 },
    blush: [
      { ox: -20, oy: 4 },
      { ox: 20, oy: 3 },
    ],
    sweatOffset: { ox: 31, oy: -22 },
    heartOffset: { ox: 24, oy: -40 },
    hopDelay: 0.28,
    shakeSign: 1,
    bobPhase: 2.1,
    bobSpeed: 2.05,
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
  { x: 34, y: 34, r: 6.5, phase: 0.0, color: '#F7C648' },
  { x: 146, y: 24, r: 5.0, phase: 1.1, color: '#5EC2F3' },
  { x: 256, y: 22, r: 5.4, phase: 2.3, color: '#EE86BF' },
  { x: 366, y: 36, r: 6.8, phase: 3.4, color: '#34D399' },
  { x: 200, y: 14, r: 4.4, phase: 4.5, color: '#2563EB' },
] as const;

/** Teardrop sweat path centered at (0, 0) */
export const SWEAT_PATH =
  'M0,-8 C3.6,-2.5 5.4,1.2 5.4,4.2 A5.4,5.4 0 1,1 -5.4,4.2 C-5.4,1.2 -3.6,-2.5 0,-8 Z';

/** Cute celebration heart path centered at (0, 0) */
export const HEART_PATH =
  'M0,6.5 C-0.6,5.9 -7.2,1.2 -7.2,-2.6 C-7.2,-5.4 -5.0,-7.4 -2.5,-7.4 C-1.0,-7.4 0,-6.4 0,-5.3 C0,-6.4 1.0,-7.4 2.5,-7.4 C5.0,-7.4 7.2,-5.4 7.2,-2.6 C7.2,1.2 0.6,5.9 0,6.5 Z';

/** Transform string placing a sweat drop at (x, y) with optional scale */
export function sweatAt(x: number, y: number, scale = 1): string {
  return `translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${scale.toFixed(3)})`;
}

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
  const w = r * 0.78;
  const baseY = cy - r - 3.2;
  const tilt = worry * 4.4;
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
