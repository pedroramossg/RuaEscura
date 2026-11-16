import type { PersistedCampusState } from '../types/campus';
import { getSeedCampusState } from '../data/ufscTrindade';
import { PersistedCampusStateSchema } from './schemas';

export const CAMPUS_STORAGE_KEY = 'rua_escura_campus_state_v1';

function getDefaultStorage(): Storage | undefined {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

/**
 * Loads campus state from localStorage with fail-fast Zod validation and seed fallback.
 * Safely handles corrupted JSON, schema deviations, and prototype pollution attacks.
 */
export function loadCampusState(storage: Storage | undefined = getDefaultStorage()): PersistedCampusState {
  if (!storage) {
    return getSeedCampusState();
  }

  try {
    const raw = storage.getItem(CAMPUS_STORAGE_KEY);
    if (!raw) {
      return getSeedCampusState();
    }

    // Prototype pollution & malicious key check in raw JSON string
    if (
      raw.includes('"__proto__"') ||
      raw.includes('"constructor"') ||
      raw.includes('"prototype"')
    ) {
      return getSeedCampusState();
    }

    const parsed: unknown = JSON.parse(raw);

    const validation = PersistedCampusStateSchema.safeParse(parsed);
    if (!validation.success) {
      return getSeedCampusState();
    }

    return validation.data;
  } catch {
    // Corrupted JSON or parsing failure -> return clean seed state
    return getSeedCampusState();
  }
}

/**
 * Persists campus state into localStorage with Zod validation and quota protection.
 * Returns true if successfully saved, false if validation fails or storage quota exceeded.
 */
export function saveCampusState(
  state: PersistedCampusState,
  storage: Storage | undefined = getDefaultStorage()
): boolean {
  if (!storage) {
    return false;
  }

  try {
    const validation = PersistedCampusStateSchema.safeParse(state);
    if (!validation.success) {
      return false;
    }

    const serialized = JSON.stringify(validation.data);
    storage.setItem(CAMPUS_STORAGE_KEY, serialized);
    return true;
  } catch {
    // QuotaExceededError or DOMException caught gracefully
    return false;
  }
}
