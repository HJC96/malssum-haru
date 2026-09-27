export const VISIT_PATH = '/api/visits';

/** Records one page load; no cookie, browser storage, identifier, or request body. */
export async function recordVisit(fetchImpl: typeof fetch = fetch): Promise<number> {
  const response = await fetchImpl(VISIT_PATH, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`Visit count unavailable (${response.status})`);
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || !('count' in value)) throw new Error('Invalid visit count response');
  const count = value.count;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1) throw new Error('Invalid visit count response');
  return count;
}

let pageLoadVisit: Promise<number | null> | undefined;

/** Safe to call from a React effect more than once (including StrictMode effect replay). */
export function recordVisitOncePerPageLoad(): Promise<number | null> {
  return (pageLoadVisit ??= recordVisit().catch(() => null));
}
