import { describe, expect, it, vi } from 'vitest';
import { recordVisit, recordVisitOncePerPageLoad, VISIT_PATH } from './recordVisit';

describe('recordVisit', () => {
  it('POSTs once without cookies, body, or cache and returns the cumulative count', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ count: 37 }) })) as unknown as typeof fetch;
    await expect(recordVisit(fetchImpl)).resolves.toBe(37);
    expect(fetchImpl).toHaveBeenCalledWith(VISIT_PATH, {
      method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    });
  });

  it('rejects malformed and failed responses', async () => {
    await expect(recordVisit((async () => ({ ok: true, json: async () => ({ count: -1 }) })) as unknown as typeof fetch)).rejects.toThrow('Invalid');
    await expect(recordVisit((async () => ({ ok: false, status: 503 })) as unknown as typeof fetch)).rejects.toThrow('unavailable');
  });

  it('shares one request across repeated effect calls in the same page load', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ count: 38 }) }));
    vi.stubGlobal('fetch', fetchImpl);
    const first = recordVisitOncePerPageLoad();
    const second = recordVisitOncePerPageLoad();
    expect(first).toBe(second);
    await expect(first).resolves.toBe(38);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
