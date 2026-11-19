export interface SparkleSpec {
  id: number;
  xOffset: number;
  yOffset: number;
  size: number;
  color: string;
  phaseOffset: number;
  durationSec: number;
  risePx: number;
  driftPx: number;
}

export interface SparkleFrame {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotationDeg: number;
}

export const SPARKLE_SPECS: readonly SparkleSpec[] = [
  { id: 0, xOffset: -26, yOffset: -6, size: 10, color: '#FFFFFF', phaseOffset: 0.0, durationSec: 3.4, risePx: 54, driftPx: -10 },
  { id: 1, xOffset: 18, yOffset: -12, size: 12, color: '#E7DDF8', phaseOffset: 0.55, durationSec: 3.8, risePx: 62, driftPx: 8 },
  { id: 2, xOffset: -4, yOffset: -20, size: 8, color: '#F8F2D8', phaseOffset: 1.15, durationSec: 3.2, risePx: 48, driftPx: -5 },
  { id: 3, xOffset: 34, yOffset: 4, size: 9, color: '#FFFFFF', phaseOffset: 1.7, durationSec: 4.1, risePx: 58, driftPx: 11 },
  { id: 4, xOffset: -38, yOffset: 8, size: 7, color: '#E7DDF8', phaseOffset: 2.2, durationSec: 3.9, risePx: 50, driftPx: -9 },
  { id: 5, xOffset: 6, yOffset: 2, size: 11, color: '#F8F2D8', phaseOffset: 2.75, durationSec: 4.3, risePx: 66, driftPx: 4 },
  { id: 6, xOffset: -16, yOffset: -18, size: 7, color: '#FFFFFF', phaseOffset: 3.1, durationSec: 3.5, risePx: 46, driftPx: 7 },
];

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function clamp01(val: number): number {
  return clamp(val, 0, 1);
}

export function easeInOutSine(t: number): number {
  const x = clamp01(t);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

/**
 * Unnormalized Gaussian envelope used for the soft verification wave across code pills.
 */
export function gaussian(x: number, center: number, sigma: number): number {
  const d = x - center;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

/**
 * Envelope + card + sparkles tilt together about bottom-right corner: 0 -> 3 deg over 3s and back.
 */
export function envelopeTiltDeg(timeSec: number): number {
  const cycle = ((timeSec % 6) + 6) % 6;
  const phase = cycle <= 3 ? cycle / 3 : (6 - cycle) / 3;
  return 3 * easeInOutSine(phase);
}

/**
 * Slow vertical caret pulse for active code pill.
 */
export function caretOpacity(timeSec: number): number {
  return 0.16 + 0.84 * (0.5 + 0.5 * Math.sin(timeSec * Math.PI * 1.45));
}

/**
 * Returns animated offset, opacity and scale for one rising 4-point sparkle.
 */
export function computeSparkleFrame(spec: SparkleSpec, timeSec: number): SparkleFrame {
  const progress = (((timeSec + spec.phaseOffset) % spec.durationSec) + spec.durationSec) % spec.durationSec / spec.durationSec;
  const fadeIn = clamp01(progress / 0.18);
  const fadeOut = 1 - clamp01((progress - 0.58) / 0.42);
  const opacity = fadeIn * fadeOut * 0.92;
  const y = spec.yOffset - progress * spec.risePx;
  const x = spec.xOffset + Math.sin(progress * Math.PI * 1.5) * spec.driftPx;
  const scale = 0.65 + 0.45 * Math.sin(progress * Math.PI);
  const rotationDeg = progress * 24 - 12;

  return { x, y, scale, opacity, rotationDeg };
}

/**
 * Evaluates normalized wave intensity (0..1) for a pill index during green success sweep.
 */
export function computePillWaveIntensity(pillIndex: number, waveElapsedMs: number): number {
  if (waveElapsedMs < 0) return 0;
  const durationMs = 760;
  const progress = clamp01(waveElapsedMs / durationMs);
  if (progress <= 0 || progress >= 1) return 0;
  const waveCenter = -1.1 + progress * 5.4;
  return gaussian(pillIndex, waveCenter, 1.3);
}

/**
 * 4-point star SVG path centered at (cx, cy) with outer radius r and inner radius r * 0.28.
 */
export function fourPointStarPath(cx: number, cy: number, r: number): string {
  const inner = r * 0.28;
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx + inner} ${cy - inner} ${cx + r} ${cy}`,
    `Q ${cx + inner} ${cy + inner} ${cx} ${cy + r}`,
    `Q ${cx - inner} ${cy + inner} ${cx - r} ${cy}`,
    `Q ${cx - inner} ${cy - inner} ${cx} ${cy - r} Z`,
  ].join(' ');
}

