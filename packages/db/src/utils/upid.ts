import { randomBytes } from "node:crypto";

/**
 * Base62 alphabet for URL-safe UPIDs.
 * Contains 0-9, A-Z, a-z (62 characters total).
 */
const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a random base62 string suitable for use as a UPID.
 * Uses 16 characters by default, providing ~95 bits of entropy.
 */
export function randomUpidString(length = 16): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = bytes[i]! % BASE62_ALPHABET.length;
    result += BASE62_ALPHABET[index]!;
  }
  return result;
}

/**
 * @deprecated Use randomUpidString instead. This is kept for backwards compatibility.
 */
export function randomNumericString(length = 16): string {
  return randomUpidString(length);
}

type IsTakenFn = (candidate: string) => Promise<boolean>;
type FetchTakenSetFn = (candidates: readonly string[]) => Promise<Set<string>>;

export interface GenerateUniqueUpidOptions {
  length?: number;
  maxAttempts?: number;
  isTaken: IsTakenFn;
}

export async function generateUniqueUpid({
  length = 16,
  maxAttempts = 10,
  isTaken,
}: GenerateUniqueUpidOptions): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = randomUpidString(length);
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new Error("Failed to generate unique UPID");
}

export interface GenerateUniqueUpidsOptions extends GenerateUniqueUpidOptions {
  count: number;
  fetchTakenSet: FetchTakenSetFn;
  minBatchSize?: number;
  maxBatchSize?: number;
  safetyThreshold?: number;
}

export async function generateUniqueUpids({
  count,
  length = 16,
  maxAttempts = 10,
  isTaken,
  fetchTakenSet,
  minBatchSize = 8,
  maxBatchSize = 128,
  safetyThreshold = 5,
}: GenerateUniqueUpidsOptions): Promise<string[]> {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [await generateUniqueUpid({ length, maxAttempts, isTaken })];
  }

  const unique = new Set<string>();
  let safetyCounter = 0;

  while (unique.size < count) {
    const remaining = count - unique.size;
    const batchSize = Math.min(
      Math.max(remaining * 2, minBatchSize),
      maxBatchSize,
    );
    const candidates = Array.from({ length: batchSize }, () =>
      randomUpidString(length),
    );

    const taken = await fetchTakenSet(candidates);

    const sizeBefore = unique.size;
    for (const candidate of candidates) {
      if (taken.has(candidate) || unique.has(candidate)) {
        continue;
      }
      unique.add(candidate);
      if (unique.size === count) {
        break;
      }
    }

    if (unique.size === sizeBefore) {
      safetyCounter += 1;
    } else {
      safetyCounter = 0;
    }

    if (safetyCounter >= safetyThreshold) {
      const fallback = await generateUniqueUpid({
        length,
        maxAttempts,
        isTaken,
      });
      unique.add(fallback);
      safetyCounter = 0;
    }
  }

  return Array.from(unique).slice(0, count);
}
