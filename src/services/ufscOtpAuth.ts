import { UfscEmailSchema } from '../security/schemas';

export const DEMO_UFSC_EMAIL = 'mariana.silva@grad.ufsc.br';
export const DEMO_OTP_CODE = '5739';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 5000;

export interface OtpChallenge {
  email: string;
  maskedEmail: string;
  mode: 'supabase' | 'sandbox';
  expiresAt: number;
  devCodeHint?: string;
}

interface SandboxChallengeRecord {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const sandboxChallenges = new Map<string, SandboxChallengeRecord>();

/**
 * Masks an email address for UI confirmation while keeping institutional domain legible.
 */
export function maskEmail(email: string): string {
  const [local = '', domain = 'ufsc.br'] = email.trim().toLowerCase().split('@');
  if (local.length <= 2) {
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `${local.slice(0, 3)}***@${domain}`;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower === '::1') {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lower)) {
    const [a, b] = lower.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return false;
}

interface SupabaseEnvConfig {
  baseUrl: string;
  anonKey: string;
}

function getSupabaseEnvConfig(): SupabaseEnvConfig | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const rawUrl = env?.VITE_SUPABASE_URL?.trim();
  const anonKey = env?.VITE_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !anonKey) return null;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' || isPrivateOrLocalHostname(parsed.hostname)) {
      return null;
    }
    return {
      baseUrl: parsed.origin,
      anonKey,
    };
  } catch {
    return null;
  }
}

function generateSecureOtpCode(email: string): string {
  if (email === DEMO_UFSC_EMAIL) {
    return DEMO_OTP_CODE;
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const num = 1000 + (bytes[0] % 9000);
    return String(num);
  }

  return DEMO_OTP_CODE;
}

async function fetchSupabaseOtp(
  config: SupabaseEnvConfig,
  path: string,
  payload: Record<string, unknown>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Clears in-memory sandbox OTP challenges (used in unit tests).
 */
export function clearOtpChallenges(): void {
  sandboxChallenges.clear();
}

/**
 * Dispatches a 4-digit verification OTP to a validated `@ufsc.br` email address.
 * Uses real Supabase Auth HTTP endpoint when `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`
 * are configured; falls back cleanly to local cryptographic sandbox challenge otherwise.
 */
export async function sendUfscOtpCode(rawEmail: string): Promise<OtpChallenge> {
  const email = UfscEmailSchema.parse(rawEmail);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const supabase = getSupabaseEnvConfig();

  if (supabase) {
    const response = await fetchSupabaseOtp(supabase, '/auth/v1/otp', {
      email,
      create_user: true,
    });

    if (!response.ok) {
      throw new Error('Não foi possível enviar o código pelo servidor. Tente novamente em instantes.');
    }

    return {
      email,
      maskedEmail: maskEmail(email),
      mode: 'supabase',
      expiresAt,
    };
  }

  const code = generateSecureOtpCode(email);
  sandboxChallenges.set(email, {
    email,
    code,
    expiresAt,
    attempts: 0,
  });

  return {
    email,
    maskedEmail: maskEmail(email),
    mode: 'sandbox',
    expiresAt,
    devCodeHint: code,
  };
}

/**
 * Verifies a 4-digit OTP code against Supabase Auth or active local sandbox challenge.
 */
export async function verifyUfscOtpCode(
  rawEmail: string,
  rawCode: string
): Promise<{ verified: true; mode: 'supabase' | 'sandbox'; email: string }> {
  const email = UfscEmailSchema.parse(rawEmail);
  const code = rawCode.replace(/\D/g, '').slice(0, 6);

  if (code.length !== 4 && !getSupabaseEnvConfig()) {
    throw new Error('Digite os 4 dígitos do código enviado para o seu e-mail UFSC.');
  }

  const supabase = getSupabaseEnvConfig();
  if (supabase) {
    if (code.length < 4) {
      throw new Error('Código incompleto. Digite os dígitos recebidos no e-mail.');
    }
    const response = await fetchSupabaseOtp(supabase, '/auth/v1/verify', {
      email,
      token: code,
      type: 'email',
    });

    if (!response.ok) {
      throw new Error('Código inválido ou expirado. Confira seu e-mail UFSC ou solicite um novo.');
    }

    return { verified: true, mode: 'supabase', email };
  }

  const record = sandboxChallenges.get(email);
  if (!record) {
    throw new Error('Código expirado. Toque em "Reenviar código" para gerar um novo.');
  }

  if (Date.now() > record.expiresAt) {
    sandboxChallenges.delete(email);
    throw new Error('Este código expirou. Toque em "Reenviar código".');
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    sandboxChallenges.delete(email);
    throw new Error('Muitas tentativas incorretas. Solicite um novo código.');
  }

  if (code !== record.code) {
    record.attempts += 1;
    throw new Error('Código incorreto. Confira os 4 dígitos e tente novamente.');
  }

  sandboxChallenges.delete(email);
  return { verified: true, mode: 'sandbox', email };
}

