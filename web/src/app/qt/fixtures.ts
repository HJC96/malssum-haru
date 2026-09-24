/**
 * 계약 예시(docs/contracts/qt-today.md) 기반 mock. 장절 표기 정도의 구조 정보만 담고
 * 성경 본문·제공처 해설은 넣지 않는다.
 */
export type QtMockScenario =
  | 'mixed'
  | 'confirmed'
  | 'unavailable'
  | 'not-permitted'
  | 'link-error'
  | 'disabled';

import { durannoDateUrl, MAEIL_TODAY_URL } from './officialLinks';

const NOTICE = {
  ko: '본문은 공식 페이지에서 읽을 수 있습니다.',
  en: 'Read the text on the official page. The source is Korean only.',
};

const DATE = '2026-09-24';

export function maeilConfirmed() {
  return {
    providerId: 'maeil-seongyeong',
    providerName: { ko: '매일성경', en: 'Maeil Seongyeong (Daily Bible)' },
    providerTimeZone: 'Asia/Seoul',
    providerDate: DATE,
    availabilityStatus: 'RANGE_CONFIRMED',
    reasonCode: null,
    passage: {
      ranges: [{ bookId: 'JHN', start: { chapter: 3, verse: 1 }, end: { chapter: 3, verse: 21 } }],
    },
    displayReference: '요한복음 3:1-21',
    officialUrl: MAEIL_TODAY_URL,
    officialUrlKind: 'today-page',
    verifiedAt: '2026-09-24T01:02:02Z',
    sourceVersion: 'maeil-seongyeong-adapter/1',
    bodyStatus: 'NOT_PROVIDED',
    notice: NOTICE,
  };
}

export function durannoConfirmed() {
  return {
    providerId: 'saengmyeong-ui-sam',
    providerName: { ko: '생명의삶', en: 'Saengmyeong-ui-sam (Life Application QT)' },
    providerTimeZone: 'Asia/Seoul',
    providerDate: DATE,
    availabilityStatus: 'RANGE_CONFIRMED',
    reasonCode: null,
    passage: {
      ranges: [{ bookId: 'ACT', start: { chapter: 9, verse: 32 }, end: { chapter: 10, verse: 8 } }],
    },
    displayReference: '사도행전 9:32-10:8',
    officialUrl: durannoDateUrl(DATE),
    officialUrlKind: 'date-specific',
    verifiedAt: '2026-09-24T01:02:02Z',
    sourceVersion: 'saengmyeong-ui-sam-adapter/1',
    bodyStatus: 'NOT_PROVIDED',
    notice: NOTICE,
  };
}

/** 범위를 얻지 못한 항목(생명의삶). status/reason은 시나리오별로 덮어쓴다. */
function durannoWithout(availabilityStatus: string, reasonCode: string | null) {
  return {
    ...durannoConfirmed(),
    providerDate: null,
    availabilityStatus,
    reasonCode,
    passage: null,
    displayReference: null,
    verifiedAt: null,
    notice: null,
  };
}

function response(providers: unknown[]) {
  return { schemaVersion: '1', generatedAt: '2026-09-24T01:02:03Z', providers };
}

export const QT_MOCK_SCENARIOS: Record<QtMockScenario, () => unknown> = {
  /** 계약 응답 예시와 같다: 한쪽 확인, 한쪽 파싱 실패. */
  mixed: () => response([maeilConfirmed(), durannoWithout('RANGE_UNAVAILABLE', 'PARSE_FAILED')]),
  confirmed: () => response([maeilConfirmed(), durannoConfirmed()]),
  unavailable: () =>
    response([
      { ...maeilConfirmed(), providerDate: null, availabilityStatus: 'RANGE_UNAVAILABLE', reasonCode: 'DATE_MISMATCH', passage: null, displayReference: null, verifiedAt: null, notice: null },
      durannoWithout('RANGE_UNAVAILABLE', 'PARSE_FAILED'),
    ]),
  'not-permitted': () =>
    response([
      { ...maeilConfirmed(), providerDate: null, availabilityStatus: 'RANGE_NOT_PERMITTED', reasonCode: 'PERMISSION_UNCONFIRMED', passage: null, displayReference: null, verifiedAt: null, notice: null },
      durannoWithout('RANGE_NOT_PERMITTED', 'PERMISSION_UNCONFIRMED'),
    ]),
  'link-error': () =>
    response([
      { ...maeilConfirmed(), providerDate: null, availabilityStatus: 'LINK_ERROR', reasonCode: 'LINK_UNREACHABLE', passage: null, displayReference: null, verifiedAt: null, notice: null },
      durannoConfirmed(),
    ]),
  disabled: () =>
    response([
      { ...maeilConfirmed(), providerDate: null, availabilityStatus: 'DISABLED', reasonCode: 'OPERATOR_DISABLED', passage: null, displayReference: null, verifiedAt: null, notice: null },
      durannoWithout('DISABLED', 'OPERATOR_DISABLED'),
    ]),
};

