import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  computePillWaveIntensity,
  computeSparkleFrame,
  caretOpacity,
  envelopeTiltDeg,
  fourPointStarPath,
  SPARKLE_SPECS,
  type SparkleFrame,
} from '../../lib/verification/motion';
import type { OtpChallenge } from '../../services/ufscOtpAuth';
import styles from './VerificationCodeOtp.module.css';

export interface VerificationCodeOtpProps {
  challenge: OtpChallenge;
  onVerifyCode: (code: string) => Promise<void>;
  onResendCode: () => Promise<OtpChallenge | null>;
  onBack: () => void;
  onVerified: () => void;
}

const CODE_LENGTH = 4;

const INITIAL_SPARKLES: SparkleFrame[] = SPARKLE_SPECS.map((spec) =>
  computeSparkleFrame(spec, 0)
);

export const VerificationCodeOtp: React.FC<VerificationCodeOtpProps> = ({
  challenge,
  onVerifyCode,
  onResendCode,
  onBack,
  onVerified,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [resendInfo, setResendInfo] = useState<string | null>(null);

  // Motion visual state driven smoothly by rAF
  const [tiltDeg, setTiltDeg] = useState(0);
  const [caretAlpha, setCaretAlpha] = useState(1);
  const [sparkles, setSparkles] = useState<SparkleFrame[]>(INITIAL_SPARKLES);
  const [waveIntensities, setWaveIntensities] = useState<number[]>([0, 0, 0, 0]);
  const [checkDrawProgress, setCheckDrawProgress] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const verifiedAtRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const verificationLockRef = useRef(false);

  // Focus OTP input cleanly on mount
  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
      }
    };
  }, []);

  // Main continuous motion loop (6s tilt, rising 4-pt sparkles, pulsing caret, Gaussian wave on verify)
  useEffect(() => {
    if (prefersReducedMotion) {
      setTiltDeg(0);
      setCaretAlpha(1);
      if (isVerified) {
        setCheckDrawProgress(1);
      }
      return;
    }

    let rafId = 0;
    const startMs = performance.now();

    const tick = (nowMs: number) => {
      const elapsedSec = (nowMs - startMs) / 1000;

      setTiltDeg(envelopeTiltDeg(elapsedSec));
      setCaretAlpha(caretOpacity(elapsedSec));
      setSparkles(SPARKLE_SPECS.map((spec) => computeSparkleFrame(spec, elapsedSec)));

      if (verifiedAtRef.current !== null) {
        const waveElapsed = nowMs - verifiedAtRef.current;
        setCheckDrawProgress(Math.min(1, waveElapsed / 440));
        setWaveIntensities([0, 1, 2, 3].map((i) => computePillWaveIntensity(i, waveElapsed)));
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [prefersReducedMotion, isVerified]);

  const submitDigits = async (digits: string) => {
    if (digits.length !== CODE_LENGTH || verificationLockRef.current || isVerified) return;

    verificationLockRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await onVerifyCode(digits);
      verifiedAtRef.current = performance.now();
      setIsVerified(true);
      setIsSubmitting(false);

      if (prefersReducedMotion) {
        setCheckDrawProgress(1);
        setWaveIntensities([0.3, 0.3, 0.3, 0.3]);
      }

      const celebrationMs = prefersReducedMotion ? 140 : 920;
      finishTimerRef.current = window.setTimeout(() => {
        onVerified();
      }, celebrationMs);
    } catch (err) {
      verificationLockRef.current = false;
      setIsSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Código inválido. Tente novamente ou peça um reenvio.'
      );
      setCode('');
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  const handleCodeChange = (rawValue: string) => {
    if (isVerified || isSubmitting) return;
    const clean = rawValue.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(clean);
    if (error) setError(null);
    if (resendInfo) setResendInfo(null);

    if (clean.length === CODE_LENGTH) {
      void submitDigits(clean);
    }
  };

  const handleQuickFillDemo = () => {
    if (!challenge.devCodeHint || isVerified || isSubmitting) return;
    const digits = challenge.devCodeHint.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    void submitDigits(digits);
  };

  const handleResend = async () => {
    if (isResending || isSubmitting || isVerified) return;
    setIsResending(true);
    setError(null);
    try {
      await onResendCode();
      setCode('');
      setResendInfo('Novo código enviado para o seu e-mail UFSC.');
      inputRef.current?.focus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao reenviar o código. Tente novamente.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const activeIndex = isVerified ? -1 : Math.min(code.length, CODE_LENGTH - 1);
  const checkPathLen = 28;
  const checkDashOffset = checkPathLen * (1 - checkDrawProgress);

  return (
    <section
      aria-label="Verificação de código institucional UFSC"
      className={`${styles.stage} px-5 pt-5 pb-6 sm:px-7 sm:pt-6 sm:pb-7`}
    >
      <div className={styles.backdropGlow} aria-hidden="true" />

      {/* Top minimal navigation */}
      <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting || isVerified}
          className="min-h-[44px] inline-flex items-center gap-1 pl-2 pr-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/12 text-xs font-medium text-[#ECECED] transition-colors cursor-pointer disabled:opacity-45"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Alterar e-mail</span>
        </button>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-[11px] font-medium text-[#C8C7CE]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#79FFB5]" aria-hidden="true" />
          <span>UFSC Verificada</span>
        </span>
      </div>

      {/* Motion Centerpiece: Tilting Open Envelope + 4-Point Star + 7 Sparkles / Verified Badge */}
      <div className="relative z-10 flex flex-col items-center pt-1 pb-2">
        <div
          className={styles.envelopeRig}
          style={{
            transform: prefersReducedMotion ? undefined : `rotate(${tiltDeg.toFixed(3)}deg)`,
          }}
          aria-hidden="true"
        >
          {/* 7 rising 4-point sparkles */}
          <svg
            viewBox="-70 -85 140 120"
            className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 w-[150px] h-[126px] overflow-visible z-20"
          >
            {sparkles.map((frame, idx) => {
              const spec = SPARKLE_SPECS[idx]!;
              return (
                <path
                  key={spec.id}
                  d={fourPointStarPath(0, 0, spec.size / 2)}
                  fill={spec.color}
                  opacity={isVerified ? 0 : frame.opacity}
                  transform={`translate(${frame.x.toFixed(2)}, ${frame.y.toFixed(2)}) scale(${frame.scale.toFixed(3)}) rotate(${frame.rotationDeg.toFixed(1)})`}
                />
              );
            })}
          </svg>

          {!imageFailed ? (
            <img
              src="/art/envelope.webp"
              alt=""
              width={470}
              height={452}
              onError={() => setImageFailed(true)}
              className={`w-full h-full object-contain select-none transition-all duration-300 ${
                isVerified ? 'scale-90 opacity-35 blur-[1px]' : 'scale-100 opacity-100'
              }`}
            />
          ) : (
            /* Crisp inline dark vector envelope + white star card fallback */
            <svg
              viewBox="0 0 180 172"
              className={`w-full h-full transition-all duration-300 ${
                isVerified ? 'scale-90 opacity-35' : 'scale-100 opacity-100'
              }`}
            >
              <defs>
                <linearGradient id="envBody" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#26262C" />
                  <stop offset="100%" stopColor="#141418" />
                </linearGradient>
              </defs>
              <path
                d="M16 58 L90 12 L164 58 L164 146 Q164 158 152 158 L28 158 Q16 158 16 146 Z"
                fill="#1A1A20"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1.5"
              />
              <g transform="translate(90 76) rotate(-9)">
                <rect x="-36" y="-44" width="72" height="72" rx="18" fill="#F2F2F5" />
                <path d={fourPointStarPath(0, -10, 17)} fill="#0F0F12" />
              </g>
              <path
                d="M16 62 L90 108 L164 62 L164 146 Q164 158 152 158 L28 158 Q16 158 16 146 Z"
                fill="url(#envBody)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1.5"
              />
              <path
                d="M22 154 L90 104 L158 154"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1.5"
              />
            </svg>
          )}

          {/* Green radial badge check-draw overlay when verified */}
          {isVerified && (
            <div className="absolute inset-0 flex items-center justify-center z-30">
              <div
                className={`${styles.checkCircle} w-[76px] h-[76px] rounded-full flex items-center justify-center`}
              >
                <svg viewBox="0 0 36 36" className="w-10 h-10">
                  <path
                    d="M9.5 18.5 L15.5 24.5 L27 12.5"
                    fill="none"
                    stroke="#8AFFB4"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={checkPathLen}
                    strokeDashoffset={checkDashOffset}
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Title & 2-line Subtitle */}
        <h2 className="text-[26px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#ECECED] text-center leading-tight mt-1">
          {isVerified ? 'E-mail verificado!' : 'Código de verificação'}
        </h2>
        <p className="text-[13px] sm:text-sm text-[#8C8B91] text-center leading-snug mt-1.5 max-w-[290px]">
          {isVerified ? (
            <span className="text-[#8AFFB4] font-medium">
              Acesso institucional UFSC liberado
            </span>
          ) : (
            <>
              Enviamos um código de 4 dígitos
              <br />
              para <span className="text-[#ECECED] font-medium">{challenge.email}</span>
            </>
          )}
        </p>
      </div>

      {/* 4 Pill Code Inputs with Soft Cool Active Glow & Gaussian Green Wave */}
      <div className="relative z-10 mt-5 mb-4">
        <div
          className={styles.pillRow}
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            id="ufsc-otp-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Código de verificação de 4 dígitos"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            disabled={isSubmitting || isVerified}
            maxLength={CODE_LENGTH}
            className={styles.hiddenOtpInput}
          />

          {[0, 1, 2, 3].map((slotIdx) => {
            const digit = code[slotIdx] ?? '';
            const isActive = slotIdx === activeIndex && !isVerified;
            const wave = waveIntensities[slotIdx] ?? 0;
            const offsetY = wave > 0 ? -7 * wave : 0;

            return (
              <div
                key={slotIdx}
                aria-hidden="true"
                className={[
                  styles.pill,
                  isActive ? styles.pillActive : '',
                  error ? styles.pillError : '',
                  isVerified ? styles.pillVerified : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  wave > 0.01
                    ? {
                        transform: `translateY(${offsetY.toFixed(2)}px)`,
                        boxShadow: `0 0 ${Math.round(18 + 20 * wave)}px rgba(121, 255, 181, ${(0.22 + 0.42 * wave).toFixed(3)})`,
                        borderColor: `rgba(121, 255, 181, ${(0.35 + 0.55 * wave).toFixed(3)})`,
                      }
                    : undefined
                }
              >
                {digit ? (
                  <span>{digit}</span>
                ) : isActive ? (
                  <span
                    className={styles.caret}
                    style={{ opacity: caretAlpha }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status / Error Feedback */}
      <div className="relative z-10 min-h-[24px] flex flex-col items-center justify-center text-center">
        {error && (
          <p
            role="alert"
            className="text-xs font-medium text-[#FF6961] bg-[#2B1215]/90 border border-[#EF4444]/35 px-3.5 py-2 rounded-2xl max-w-full"
          >
            {error}
          </p>
        )}
        {!error && resendInfo && (
          <p role="status" className="text-xs font-medium text-[#79FFB5]">
            {resendInfo}
          </p>
        )}
      </div>

      {/* Footer Actions: Sandbox 1-tap Demo Pill + Resend */}
      {!isVerified && (
        <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
          {challenge.mode === 'sandbox' && challenge.devCodeHint && (
            <button
              type="button"
              onClick={handleQuickFillDemo}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 rounded-full bg-white text-[#0F0F12] hover:bg-white/92 active:scale-[0.97] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              Preencher código {challenge.devCodeHint}
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={isResending || isSubmitting}
            className="min-h-[44px] px-4 rounded-full bg-white/8 hover:bg-white/14 border border-white/12 text-xs font-medium text-[#C8C7CE] hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isResending ? 'Enviando...' : 'Reenviar código'}</span>
          </button>
        </div>
      )}
    </section>
  );
};

