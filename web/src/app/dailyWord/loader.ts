import { validateDailyWord, isIsoDate } from './validate';
import type { DailyWordContent } from './types';

export interface DailyWordLoaderOptions {
  /** Directory containing one JSON artifact per Seoul calendar date. */
  basePath?: string;
  fetcher?: typeof fetch;
  /** Test-only escape hatch for unmistakably labelled test fixtures. Production leaves this false. */
  allowTestOnlyTranslations?: boolean;
}

/**
 * Load exactly `/basePath/YYYY-MM-DD.json`. There is deliberately no fixture,
 * latest-file, or previous-day fallback in this production-capable loader.
 */
export function createDailyWordLoader(options: DailyWordLoaderOptions = {}) {
  const basePath = (options.basePath ?? '/daily-word').replace(/\/$/, '');
  const fetcher = options.fetcher ?? fetch;

  return async function loadForDate(date: string): Promise<DailyWordContent | null> {
    if (!isIsoDate(date)) throw new TypeError('date must be a real YYYY-MM-DD date');
    const response = await fetcher(`${basePath}/${date}.json`, { headers: { Accept: 'application/json' } });
    // Private S3 origins commonly return 403 for a missing object when listing is disabled.
    // This fixed public artifact path has no per-user authorization, so treat either as absent.
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok) throw new Error(`Daily word request failed (${response.status})`);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Daily word response was not valid JSON');
    }
    // A caller cannot accidentally turn a test fixture into public production content.
    const allowTestOnlyTranslations = import.meta.env.MODE === 'test' && options.allowTestOnlyTranslations === true;
    return validateDailyWord(payload, date, { allowTestOnlyTranslations });
  };
}

/** Loads exactly the requested Seoul date. A missing artifact returns null, never another date. */
export function loadDailyWord(date: string, fetchImpl: typeof fetch = fetch): Promise<DailyWordContent | null> {
  return createDailyWordLoader({ fetcher: fetchImpl })(date);
}
