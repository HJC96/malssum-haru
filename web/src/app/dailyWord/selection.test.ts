import { selectDailyCandidate, uniformIndex } from './selection';

describe('daily Scripture candidate selection', () => {
  const candidates = [
    { id: 'GEN-1-1', value: 'old candidate one' },
    { id: 'PSA-23-1', value: 'old candidate two' },
    { id: 'ISA-40-31', value: 'old candidate three' },
  ] as const;

  it('chooses one uniformly addressable candidate and repeats the same choice for the same date/version/testament', () => {
    const options = { date: '2026-09-26', poolVersion: 'krv-reviewed-v1', testament: 'oldTestament' as const, candidates };
    const first = selectDailyCandidate(options);
    expect(selectDailyCandidate(options)).toEqual(first);
    expect(candidates).toContainEqual(first);
  });

  it('isolates testament pools and changes the result domain with pool versioning', () => {
    const old = selectDailyCandidate({ date: '2026-09-26', poolVersion: 'v1', testament: 'oldTestament', candidates });
    const newCandidates = candidates.map((candidate) => ({ ...candidate, id: `NT-${candidate.id}` }));
    const newer = selectDailyCandidate({ date: '2026-09-26', poolVersion: 'v1', testament: 'newTestament', candidates: newCandidates });
    expect(old.id).not.toMatch(/^NT-/);
    expect(newer.id).toMatch(/^NT-/);
    expect(selectDailyCandidate({ date: '2026-09-26', poolVersion: 'v2', testament: 'oldTestament', candidates })).toBeDefined();
  });

  it('rejects the biased tail before mapping the random number to a pool index', () => {
    const source = vi.fn().mockReturnValueOnce(0xffff_ffff).mockReturnValueOnce(5);
    expect(uniformIndex(3, source)).toBe(2);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid pool sizes and duplicate candidate IDs', () => {
    expect(() => uniformIndex(0, () => 0)).toThrow(RangeError);
    expect(() => selectDailyCandidate({ date: '2026-09-26', poolVersion: 'v1', testament: 'oldTestament', candidates: [] })).toThrow(RangeError);
    expect(() => selectDailyCandidate({
      date: '2026-09-26', poolVersion: 'v1', testament: 'oldTestament',
      candidates: [{ id: 'same', value: 1 }, { id: 'same', value: 2 }],
    })).toThrow(/unique/);
  });
});
