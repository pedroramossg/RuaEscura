import { z } from 'zod';
import type { PersistedCampusState } from '../types/campus';

/**
 * Validates Brazilian Individual Taxpayer Registry (CPF) with checksum check digits.
 * Rejects repeated sequence digits (e.g. 111.111.111-11) and invalid formats.
 */
export function isValidCpf(cpf: string): boolean {
  if (typeof cpf !== 'string') return false;
  const clean = cpf.replace(/\D/g, '');

  if (clean.length !== 11) return false;

  // Check for repeated sequence digits (e.g. 000.000.000-00, 111.111.111-11)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i], 10) * (10 - i);
  }
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(clean[9], 10)) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i], 10) * (11 - i);
  }
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(clean[10], 10)) return false;

  return true;
}

/**
 * Masks CPF for privacy display, e.g. '123.456.789-09' -> '***.456.789-**'.
 */
export function maskCpf(cpf: string): string {
  if (typeof cpf !== 'string') return '***.***.***-**';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return '***.***.***-**';
  return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
}

/**
 * Validates whether string is safe from HTML tags and active script protocols.
 */
export function isSafeText(val: string): boolean {
  if (typeof val !== 'string') return false;
  if (val.includes('<') || val.includes('>')) return false;
  const lower = val.toLowerCase();
  if (
    lower.includes('javascript:') ||
    lower.includes('data:') ||
    lower.includes('vbscript:') ||
    /on\w+\s*=/i.test(lower)
  ) {
    return false;
  }
  return true;
}

export const GovBrAuthSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(100, 'Nome excede 100 caracteres')
    .refine(isSafeText, 'Nome contém caracteres inválidos (<, >)'),
  cpf: z
    .string({ required_error: 'CPF é obrigatório' })
    .trim()
    .refine(isValidCpf, 'CPF inválido ou com dígitos verificadores incorretos'),
  affiliation: z
    .string({ required_error: 'Vínculo UFSC é obrigatório' })
    .trim()
    .min(2, 'Vínculo deve ter ao menos 2 caracteres')
    .max(100, 'Vínculo excede 100 caracteres')
    .refine(isSafeText, 'Vínculo contém caracteres inválidos'),
});

const QrCodeRawSchema = z
  .string({ required_error: 'Código QR é obrigatório' })
  .trim()
  .min(5, 'Código de poste muito curto')
  .max(30, 'Código excede tamanho máximo')
  .regex(/^POSTE-[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Formato de QR code inválido. Exemplo: POSTE-BU-01')
  .refine(isSafeText, 'Código contém caracteres proibidos');

export const QrCodeInputSchema = z.preprocess((val) => {
  if (typeof val === 'object' && val !== null && 'code' in val) {
    return (val as { code: unknown }).code;
  }
  return val;
}, QrCodeRawSchema);

export const LightRatingSchema = z.object({
  edgeId: z.string().min(1, 'Identificador de trecho obrigatório').max(100),
  rating: z
    .number({ required_error: 'Nota é obrigatória' })
    .int('Avaliação deve ser um número inteiro')
    .min(1, 'Avaliação mínima é 1')
    .max(5, 'Avaliação máxima é 5'),
});

const SAFE_THUMBNAIL_DATA_URL_REGEX = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

const SafePhotoThumbnailSchema = z
  .string()
  .regex(
    SAFE_THUMBNAIL_DATA_URL_REGEX,
    'Formato de miniatura inválido (permitido apenas WebP, JPEG ou PNG).'
  )
  .max(250000);

export const ReportSubmissionSchema = z.object({
  category: z.enum(['iluminacao', 'assedio', 'suspeito', 'manutencao', 'outro'], {
    errorMap: () => ({ message: 'Categoria de denúncia inválida' }),
  }),
  location: z
    .string({ required_error: 'Localização é obrigatória' })
    .trim()
    .min(2, 'Local deve ter ao menos 2 caracteres')
    .max(120, 'Local excede 120 caracteres')
    .refine(isSafeText, 'Local contém caracteres proibidos (<, >)'),
  description: z
    .string({ required_error: 'Descrição é obrigatória' })
    .trim()
    .min(10, 'Descrição deve ter ao menos 10 caracteres')
    .max(500, 'Descrição excede 500 caracteres')
    .refine(
      isSafeText,
      'Descrição contém caracteres inválidos ou scripts (<, >, javascript:)'
    ),
  isConfidential: z.boolean().default(true),
  photoThumbnailUrl: SafePhotoThumbnailSchema.optional(),
});

export const ChatMessageSchema = z.object({
  senderId: z.string().min(1).max(100),
  senderName: z
    .string()
    .trim()
    .min(1, 'Nome do remetente obrigatório')
    .max(100)
    .refine(isSafeText, 'Nome contém caracteres inválidos'),
  text: z
    .string({ required_error: 'Mensagem não pode ser vazia' })
    .trim()
    .min(1, 'Mensagem não pode ser vazia')
    .max(240, 'Mensagem excede 240 caracteres')
    .refine(isSafeText, 'Mensagem contém caracteres inválidos ou scripts (<, >, javascript:)'),
});

const CoordinatesSchema = z.tuple([z.number(), z.number()]);

const LampPostSchema = z.object({
  id: z.string(),
  name: z.string(),
  coordinates: CoordinatesSchema,
  status: z.enum(['aceso', 'oscilando', 'queimado']),
  connectedEdgeIds: z.array(z.string()),
  lastUpdated: z.string(),
});

const EdgeRatingSummarySchema = z.object({
  averageRating: z.number().min(1).max(5),
  count: z.number().nonnegative(),
});

const IncidentReportSchema = z.object({
  id: z.string(),
  category: z.enum(['iluminacao', 'assedio', 'suspeito', 'manutencao', 'outro']),
  locationName: z.string().refine(isSafeText, 'Localização contém caracteres inválidos (<, >)'),
  locationNodeId: z.string().optional(),
  description: z.string().refine(isSafeText, 'Descrição contém caracteres inválidos (<, >)'),
  isConfidential: z.boolean(),
  createdAt: z.string(),
  status: z.enum(['pendente', 'em_analise', 'resolvido']),
  photoThumbnailUrl: SafePhotoThumbnailSchema.optional(),
});

const CompanionMatchSchema = z.object({
  id: z.string(),
  name: z.string().refine(isSafeText, 'Nome contém caracteres inválidos'),
  initials: z.string().refine(isSafeText, 'Iniciais contêm caracteres inválidos'),
  ufscAffiliation: z.string().refine(isSafeText, 'Vínculo contém caracteres inválidos'),
  isGovBrVerified: z.boolean(),
  originId: z.string(),
  destinationId: z.string(),
  departureTime: z.string(),
  currentStatus: z.enum(['aguardando', 'a_caminho', 'concluido']),
  isUserJoined: z.boolean().optional(),
});

const GovBrSessionSchema = z.object({
  name: z.string().refine(isSafeText, 'Nome contém caracteres inválidos'),
  cpfMasked: z.string().refine(isSafeText, 'CPF contém caracteres inválidos'),
  affiliation: z.string().refine(isSafeText, 'Vínculo contém caracteres inválidos'),
  verifiedAt: z.string(),
});

export const ScheduledDepartureSchema = z.object({
  time: z
    .string({ required_error: 'Horário de saída é obrigatório' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de horário inválido (use HH:MM)'),
  updatedAt: z.string(),
});

export const PersistedCampusStateSchema: z.ZodType<PersistedCampusState> = z
  .object({
    version: z.number().int().positive(),
    onboardingCompleted: z.boolean(),
    selectedBuildings: z.array(z.string()),
    timeSlot: z.string(),
    isNightMap: z.boolean(),
    hapticsEnabled: z.boolean(),
    userSession: GovBrSessionSchema.nullable(),
    posts: z.array(LampPostSchema),
    edgeRatings: z.record(z.string(), EdgeRatingSummarySchema),
    reports: z.array(IncidentReportSchema),
    companionMatches: z.array(CompanionMatchSchema),
    chatMessages: z.record(
      z.string(),
      z.array(
        z.object({
          id: z.string(),
          senderId: z.string(),
          senderName: z.string().refine(isSafeText, 'Nome contém caracteres inválidos'),
          text: z.string().refine(isSafeText, 'Mensagem contém caracteres inválidos ou scripts (<, >, javascript:)'),
          timestamp: z.string(),
          isSystem: z.boolean().optional(),
        })
      )
    ),
    activeOriginId: z.string(),
    activeDestinationId: z.string(),
    routeMode: z.enum(['brightest', 'fastest']),
    scheduledDeparture: ScheduledDepartureSchema.optional(),
  })
  .refine(
    (data) => {
      // Prototype pollution defense: verify object does not contain prototype properties
      const keys = Object.getOwnPropertyNames(data);
      return !keys.includes('__proto__') && !keys.includes('constructor') && !keys.includes('prototype');
    },
    { message: 'Objeto de estado inválido ou corrompido' }
  );
