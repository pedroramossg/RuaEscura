import type { GovBrSession } from '../types/campus';

export type IdentityGender = 'female' | 'male' | 'unknown';

const MALE_NAMES = new Set([
  'alex', 'alexandre', 'andre', 'angelo', 'antonio', 'arthur', 'artur', 'augusto',
  'benjamin', 'bernardo', 'breno', 'bruno', 'caio', 'carlos', 'caua', 'cesar', 'christian',
  'cristiano', 'daniel', 'danilo', 'davi', 'david', 'diego', 'diogo', 'douglas',
  'eduardo', 'elias', 'emanuel', 'emerson', 'enrico', 'enzo', 'eric', 'erick', 'estevao',
  'evandro', 'everton', 'fabio', 'fabricio', 'felipe', 'fernando', 'filipe', 'flavio',
  'francisco', 'frederico', 'gabriel', 'gael', 'gilberto', 'giovani', 'giovanni',
  'guilherme', 'gustavo', 'hector', 'heitor', 'henrique', 'hugo', 'ian', 'igor',
  'isaac', 'ismael', 'ivan', 'janderson', 'jefferson', 'joao', 'joaquim', 'jonas',
  'jonathan', 'jorge', 'jose', 'joshua', 'juan', 'juliano', 'julio', 'kaio', 'kaua',
  'kevin', 'kleber', 'leandro', 'leonardo', 'levi', 'lorenzo', 'luan', 'luca', 'lucas',
  'luciano', 'luis', 'luiz', 'maicon', 'manoel', 'manuel', 'marcelo', 'marcio', 'marco',
  'marcos', 'mateus', 'matheus', 'mauricio', 'max', 'miguel', 'moises', 'murilo',
  'nathan', 'nelson', 'nicholas', 'nicolas', 'nikolas', 'noah', 'otavio', 'pablo',
  'patrick', 'paulo', 'pedro', 'rafael', 'raoni', 'raul', 'renan', 'renato', 'ricardo',
  'roberto', 'rodrigo', 'roger', 'rogerio', 'romulo', 'ronaldo', 'ruan', 'ryan',
  'samuel', 'sandro', 'saulo', 'sergio', 'silvio', 'tales', 'thales', 'theo', 'thiago',
  'thomas', 'tiago', 'tomas', 'valter', 'vagner', 'vinicio', 'vinicius', 'vitor',
  'victor', 'wagner', 'wallace', 'wesley', 'william', 'yago', 'yan', 'yuri',
]);

const FEMALE_NAMES = new Set([
  'adriana', 'agatha', 'alessandra', 'alice', 'aline', 'amanda', 'ana', 'andrea',
  'andreia', 'andressa', 'angelica', 'anna', 'antonia', 'ariane', 'barbara', 'beatriz',
  'bianca', 'brenda', 'bruna', 'camila', 'carina', 'carla', 'carol', 'carolina',
  'caroline', 'catarina', 'cecilia', 'celina', 'clara', 'clarice', 'claudia', 'cristiana',
  'cristina', 'daiane', 'daniela', 'danielle', 'dayane', 'debora', 'denise', 'diana',
  'eduarda', 'elaine', 'elena', 'eliana', 'elisa', 'eloa', 'eloisa', 'emily', 'erica',
  'ester', 'esther', 'evelyn', 'fabiana', 'fabiola', 'fernanda', 'flavia', 'franciele',
  'gabriela', 'gabrielle', 'giovana', 'giovanna', 'giselle', 'giulia', 'graziela',
  'helena', 'heloisa', 'ingrid', 'isabel', 'isabela', 'isabella', 'isadora', 'isis',
  'izabela', 'jaqueline', 'jessica', 'joana', 'joyce', 'julia', 'juliana', 'karen',
  'karina', 'karine', 'katerine', 'katia', 'kelly', 'lara', 'larissa', 'laura',
  'lavinia', 'leticia', 'lidia', 'ligia', 'lilian', 'livia', 'lorena', 'luana', 'lucia',
  'luciana', 'luisa', 'luiza', 'luna', 'maite', 'manuela', 'manu', 'marcela', 'marcia',
  'maria', 'mariana', 'mariane', 'marina', 'marisa', 'marta', 'mayara', 'melissa',
  'michele', 'michelle', 'milena', 'mirella', 'monica', 'nadia', 'natalia', 'natasha',
  'nayara', 'nicole', 'nina', 'paloma', 'paola', 'patricia', 'paula', 'poliana',
  'priscila', 'rafaela', 'raissa', 'raquel', 'rayssa', 'rebeca', 'rebecca', 'regina',
  'renata', 'roberta', 'rosa', 'rosana', 'sabrina', 'samara', 'sandra', 'sara', 'sarah',
  'silvia', 'simone', 'sofia', 'sophia', 'stefany', 'stephany', 'suelen', 'taila',
  'talita', 'tamires', 'tatiana', 'tatiane', 'thais', 'thalita', 'thamires', 'valentina',
  'valeria', 'vanessa', 'veronica', 'victoria', 'vitoria', 'yasmin', 'yasmim',
]);

function normalizeToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * Extracts the probable first given name from an institutional `@ufsc.br` email local-part
 * (e.g. `"pedro.ramos@grad.ufsc.br"` -> `"pedro"`, `"ana_silva2@ufsc.br"` -> `"ana"`).
 */
export function extractEmailFirstName(email?: string | null): string | null {
  if (!email || typeof email !== 'string') return null;
  const localPart = email.trim().split('@')[0] ?? '';
  if (!localPart) return null;

  const segments = localPart
    .split(/[._+\-\d]+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 2);

  return segments[0] ?? null;
}

/**
 * Classifies first name into `'female' | 'male' | 'unknown'`.
 */
export function classifyNameGender(rawFirstName?: string | null): IdentityGender {
  if (!rawFirstName) return 'unknown';
  const normalized = normalizeToken(rawFirstName);
  if (!normalized || normalized.length < 2) return 'unknown';

  if (MALE_NAMES.has(normalized)) return 'male';
  if (FEMALE_NAMES.has(normalized)) return 'female';

  // Conservative Portuguese ending fallback only when unambiguous
  if (normalized.endsWith('o') || normalized.endsWith('or') || normalized.endsWith('eus')) {
    return 'male';
  }
  if (normalized.endsWith('a')) {
    return 'female';
  }

  return 'unknown';
}

/**
 * Classifies an institutional account using `@ufsc.br` email FIRST (since display name can be spoofed),
 * falling back cleanly to display name only when `email` is absent.
 */
export function classifyIdentityGender(
  email?: string | null,
  fallbackName?: string | null
): { gender: IdentityGender; source: 'email' | 'name' | 'none'; firstName: string | null } {
  const emailFirst = extractEmailFirstName(email);
  if (emailFirst) {
    const emailGender = classifyNameGender(emailFirst);
    if (emailGender !== 'unknown') {
      return { gender: emailGender, source: 'email', firstName: emailFirst };
    }
  }

  if (fallbackName && typeof fallbackName === 'string') {
    const firstWord = normalizeToken(fallbackName.trim().split(/\s+/)[0] ?? '');
    if (firstWord) {
      const nameGender = classifyNameGender(firstWord);
      if (nameGender !== 'unknown') {
        return { gender: nameGender, source: 'name', firstName: firstWord };
      }
    }
  }

  return {
    gender: 'unknown',
    source: emailFirst ? 'email' : 'none',
    firstName: emailFirst,
  };
}

/**
 * Only verified accounts whose institutional email/identity classifies as female
 * may view or create women-only walking groups ("Grupo Feminino").
 */
export function canUseWomenOnlyGroups(session: GovBrSession | null): boolean {
  if (!session) return false;
  return classifyIdentityGender(session.ufscEmail, session.name).gender === 'female';
}

/**
 * Ensures any companion added to a women-only walking group is verified as female
 * based on institutional `@ufsc.br` email first name (excluding male accounts automatically).
 */
export function isMemberEligibleForWomenOnly(member: {
  ufscEmail?: string;
  name: string;
}): boolean {
  return classifyIdentityGender(member.ufscEmail, member.name).gender === 'female';
}
