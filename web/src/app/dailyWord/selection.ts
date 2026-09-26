/** A candidate has already passed translation, reference, and explanation review. */
export interface DailyWordCandidate<T> {
  id: string;
  value: T;
}

export type TestamentPool = 'oldTestament' | 'newTestament';

/**
 * Select an unbiased index from a 32-bit source by rejecting the incomplete tail.
 * Keeping this seam separate makes the algorithm testable without consuming Scripture data.
 */
export function uniformIndex(size: number, nextUint32: () => number): number {
  if (!Number.isInteger(size) || size < 1 || size > 0x1_0000_0000) {
    throw new RangeError('candidate pool size must be between 1 and 2^32');
  }
  const domain = 0x1_0000_0000;
  const limit = Math.floor(domain / size) * size;
  for (;;) {
    const value = nextUint32();
    if (!Number.isInteger(value) || value < 0 || value >= domain) {
      throw new RangeError('random source must return an unsigned 32-bit integer');
    }
    if (value < limit) return value % size;
  }
}

function seededUint32(seed: string): () => number {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 0x01000193);
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
}

/**
 * Date-stable uniform sampling. Bump poolVersion whenever candidate membership or order changes.
 * Repeats across dates are allowed; reloads and language changes do not affect a date's result.
 */
export function selectDailyCandidate<T>(options: {
  date: string;
  poolVersion: string;
  testament: TestamentPool;
  candidates: readonly DailyWordCandidate<T>[];
}): DailyWordCandidate<T> {
  const { date, poolVersion, testament, candidates } = options;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('date must be YYYY-MM-DD');
  if (!poolVersion.trim()) throw new TypeError('poolVersion must not be empty');
  if (candidates.length === 0) throw new RangeError('candidate pool must not be empty');
  if (candidates.some((candidate) => !candidate.id.trim())) throw new TypeError('candidate IDs must not be empty');
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) {
    throw new TypeError('candidate IDs must be unique');
  }

  const seed = `daily-word-uniform-v1|${poolVersion}|${date}|${testament}`;
  return candidates[uniformIndex(candidates.length, seededUint32(seed))]!;
}
