import { applyFreshness, freshnessOf, seoulDate } from './freshness';
import { maeilConfirmed, durannoConfirmed } from './fixtures';
import { normalizeQtToday } from './normalize';
import type { QtProvider } from './types';

const prov = (raw: unknown): QtProvider => normalizeQtToday({ schemaVersion: '1', providers: [raw] }).providers[0]!;
const confirmed = (providerDate: string | null) => prov({ ...maeilConfirmed(), providerDate });

describe('seoulDate', () => {
  it('UTC 순간을 서울 달력 날짜로 바꾼다(자정 경계)', () => {
    expect(seoulDate(Date.parse('2026-09-24T14:59:59Z'))).toBe('2026-09-24'); // 23:59:59 KST
    expect(seoulDate(Date.parse('2026-09-24T15:00:00Z'))).toBe('2026-09-25'); // 00:00:00 KST
  });
});

describe('freshnessOf / applyFreshness (계약 신선도 규칙)', () => {
  it('응답 날짜와 서울 오늘이 같으면 fresh', () => {
    expect(freshnessOf(confirmed('2026-09-24'), '2026-09-24', '2026-09-24')).toBe('fresh');
  });

  it('응답을 받은 뒤 서울 날짜가 바뀌면 checking이고 범위를 오늘 것으로 그리지 않는다', () => {
    const p = confirmed('2026-09-24');
    expect(freshnessOf(p, '2026-09-24', '2026-09-25')).toBe('checking');
    expect(applyFreshness(p, '2026-09-24', '2026-09-25')).toEqual({ provider: p, checking: true });
  });

  it('응답을 받은 시점에도 providerDate가 서울 오늘보다 이전이면 mismatch로 내린다(DATE_MISMATCH, 범위 없음)', () => {
    const { provider, checking } = applyFreshness(confirmed('2026-09-24'), '2026-09-25', '2026-09-25');
    expect(checking).toBe(false);
    expect(provider).toMatchObject({ availabilityStatus: 'RANGE_UNAVAILABLE', reasonCode: 'DATE_MISMATCH', passage: null, displayReference: null, providerDate: null, verifiedAt: null });
    expect(provider.officialUrl).toBe(maeilConfirmed().officialUrl); // 링크는 그대로
  });

  it('확정 범위가 아니거나 날짜가 없으면 판단하지 않는다', () => {
    const unavailable = prov({ ...durannoConfirmed(), availabilityStatus: 'RANGE_UNAVAILABLE', passage: null, providerDate: null });
    expect(freshnessOf(unavailable, '2026-09-24', '2026-09-30')).toBe('n/a');
    expect(applyFreshness(unavailable, '2026-09-24', '2026-09-30')).toEqual({ provider: unavailable, checking: false });
    expect(freshnessOf(confirmed(null), '2026-09-24', '2026-09-30')).toBe('n/a');
  });
});
