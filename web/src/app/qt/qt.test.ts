import { fallbackLinks, fetchQtToday, QT_TODAY_PATH } from './fetchQtToday';
import { QT_MOCK_SCENARIOS, maeilConfirmed } from './fixtures';
import { normalizeQtToday, QtResponseError } from './normalize';

describe('normalizeQtToday', () => {
  it('계약 예시(mixed)를 그대로 받는다', () => {
    const r = normalizeQtToday(QT_MOCK_SCENARIOS.mixed());
    expect(r.providers.map((p) => p.providerId)).toEqual(['maeil-seongyeong', 'saengmyeong-ui-sam']);
    expect(r.providers[0]?.availabilityStatus).toBe('RANGE_CONFIRMED');
    expect(r.providers[0]?.officialUrlKind).toBe('today-page');
    expect(r.providers[1]?.availabilityStatus).toBe('RANGE_UNAVAILABLE');
    expect(r.providers[1]?.passage).toBeNull();
  });

  it('모든 시나리오에서 범위가 없는 상태는 passage가 null이다', () => {
    for (const make of Object.values(QT_MOCK_SCENARIOS)) {
      for (const p of normalizeQtToday(make()).providers) {
        if (p.availabilityStatus !== 'RANGE_CONFIRMED') expect(p.passage).toBeNull();
      }
    }
  });

  it('RANGE_CONFIRMED 외 상태에 passage가 실려 와도 버린다(범위 추정 금지)', () => {
    const bad = { ...maeilConfirmed(), availabilityStatus: 'LINK_ERROR', reasonCode: 'LINK_UNREACHABLE' };
    const p = normalizeQtToday({ schemaVersion: '1', generatedAt: '', providers: [bad] }).providers[0];
    expect(p?.availabilityStatus).toBe('LINK_ERROR');
    expect(p?.passage).toBeNull();
  });

  it('RANGE_CONFIRMED인데 범위가 없거나 잘못되면 RANGE_UNAVAILABLE로 내린다', () => {
    const variants = [
      { passage: null },
      { passage: { ranges: [] } },
      { passage: { ranges: [{ bookId: 'ZZZ', start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 2 } }] } },
      { passage: { ranges: [{ bookId: 'JHN', start: { chapter: 3, verse: 5 }, end: { chapter: 3, verse: 1 } }] } },
      { passage: { ranges: [{ bookId: 'JHN', start: { chapter: 3, verse: null }, end: { chapter: 3, verse: 1 } }] } },
    ];
    for (const v of variants) {
      const p = normalizeQtToday({ schemaVersion: '1', providers: [{ ...maeilConfirmed(), ...v }] }).providers[0];
      expect(p?.availabilityStatus).toBe('RANGE_UNAVAILABLE');
      expect(p?.passage).toBeNull();
    }
  });

  it('모르는 상태·reasonCode·URL 종류에도 동작한다', () => {
    const odd = { ...maeilConfirmed(), availabilityStatus: 'SOMETHING_NEW', reasonCode: 'NEW_REASON', officialUrlKind: 'weird' };
    const p = normalizeQtToday({ schemaVersion: '1', providers: [odd] }).providers[0];
    expect(p?.availabilityStatus).toBe('UNKNOWN');
    expect(p?.officialUrlKind).toBeNull();
    expect(p?.officialUrl).toBe('https://sum.su.or.kr:8888/bible/today');
  });

  it('https가 아니거나 형식이 잘못된 URL은 버린다', () => {
    for (const officialUrl of ['http://example.com', 'javascript:alert(1)', 'not a url', '', null]) {
      const p = normalizeQtToday({ schemaVersion: '1', providers: [{ ...maeilConfirmed(), officialUrl }] }).providers[0];
      expect(p?.officialUrl).toBeNull();
    }
  });

  it('잘못된 providerDate는 null로 둔다(날짜를 지어내지 않는다)', () => {
    const p = normalizeQtToday({ schemaVersion: '1', providers: [{ ...maeilConfirmed(), providerDate: '24/09/2026' }] }).providers[0];
    expect(p?.providerDate).toBeNull();
  });

  it('계약에 없는 본문 필드는 결과에 옮기지 않는다', () => {
    const withBody = { ...maeilConfirmed(), bodyText: '본문 전문', commentary: '해설' };
    const p = normalizeQtToday({ schemaVersion: '1', providers: [withBody] }).providers[0];
    expect(JSON.stringify(p)).not.toContain('본문 전문');
    expect(JSON.stringify(p)).not.toContain('해설');
  });

  it('같은 책의 비연속 범위 여러 개를 그대로 받는다(계약 v1.1)', () => {
    const psalm = {
      ...maeilConfirmed(),
      passage: {
        ranges: [
          { bookId: 'PSA', start: { chapter: 23, verse: 1 }, end: { chapter: 23, verse: 3 } },
          { bookId: 'PSA', start: { chapter: 23, verse: 5 }, end: { chapter: 23, verse: 6 } },
        ],
      },
    };
    const p = normalizeQtToday({ schemaVersion: '1', providers: [psalm] }).providers[0];
    expect(p?.availabilityStatus).toBe('RANGE_CONFIRMED');
    expect(p?.passage?.ranges).toHaveLength(2);
  });

  it('스키마 버전 불일치나 형식 오류는 QtResponseError', () => {
    expect(() => normalizeQtToday({ schemaVersion: '2', providers: [] })).toThrow(QtResponseError);
    expect(() => normalizeQtToday(null)).toThrow(QtResponseError);
    expect(() => normalizeQtToday({ schemaVersion: '1' })).toThrow(QtResponseError);
    expect(() => normalizeQtToday({ schemaVersion: '1', providers: [] })).toThrow(QtResponseError);
  });
});

describe('fetchQtToday', () => {
  it('mock 출처는 네트워크를 쓰지 않고 계약 형식을 돌려준다', async () => {
    const fetchImpl = vi.fn();
    const r = await fetchQtToday({ source: 'mock', mockScenario: 'confirmed', fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.providers).toHaveLength(2);
    expect(r.providers.every((p) => p.availabilityStatus === 'RANGE_CONFIRMED')).toBe(true);
  });

  it('api 출처는 /api/qt/today로 쿠키·쿼리·본문 없이 GET한다', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(QT_MOCK_SCENARIOS.mixed()), { status: 200 }));
    await fetchQtToday({ source: 'api', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(QT_TODAY_PATH);
    expect(url).not.toContain('?');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe('omit');
  });

  it('HTTP 오류·JSON 아님·스키마 불일치는 reject한다', async () => {
    const respond = (body: string, status = 200) => vi.fn(async () => new Response(body, { status }));
    await expect(fetchQtToday({ source: 'api', fetchImpl: respond('{}', 503) })).rejects.toThrow(QtResponseError);
    await expect(fetchQtToday({ source: 'api', fetchImpl: respond('<html>') })).rejects.toThrow(QtResponseError);
    await expect(fetchQtToday({ source: 'api', fetchImpl: respond('{"schemaVersion":"9","providers":[]}') })).rejects.toThrow(QtResponseError);
  });

  it('네트워크 실패도 reject한다', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network');
    });
    await expect(fetchQtToday({ source: 'api', fetchImpl })).rejects.toThrow();
  });
});

describe('fallbackLinks', () => {
  it('두 제공처의 https 링크만 있고 범위 정보는 없다. 생명의삶 날짜는 서울 기준 오늘', () => {
    // UTC 2026-09-23 16:00 = 서울 2026-09-24 01:00
    const links = fallbackLinks(new Date('2026-09-23T16:00:00Z'));
    expect(links.map((l) => l.providerId)).toEqual(['maeil-seongyeong', 'saengmyeong-ui-sam']);
    expect(links.every((l) => l.url.startsWith('https://'))).toBe(true);
    expect(links[1]?.url).toBe('https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-24');
    expect(Object.keys(links[0] ?? {})).not.toContain('passage');
  });
});
