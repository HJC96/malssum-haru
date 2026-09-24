import { localIsoDate } from '@/i18n/format';
import type { QtProvider } from './types';

/**
 * QT 계약 "신선도 규칙"(qa-review F-06): 서울 날짜가 바뀐 뒤에도 어제 범위를 "오늘의 범위"로 단정하지 않는다.
 * 시간은 호출 쪽이 넘긴다(시계를 직접 읽지 않으므로 테스트에서 주입할 수 있다).
 */
export const SEOUL_TZ = 'Asia/Seoul';

export const seoulDate = (ms: number): string => localIsoDate(new Date(ms), SEOUL_TZ);

export type Freshness =
  /** 확정 범위가 아니거나 날짜를 비교할 수 없어 신선도 판단이 필요 없다. */
  | 'n/a'
  /** 확정 범위이고 응답을 받은 서울 날짜와 providerDate가 같다. */
  | 'fresh'
  /** 응답 뒤에 서울 날짜가 바뀌었다. 다시 조회하는 동안 범위를 오늘 것으로 보이지 않는다. */
  | 'checking'
  /** 응답을 받은 시점에도 providerDate가 서울 오늘이 아니었다(서버·캐시 이상). 범위를 쓰지 않는다. */
  | 'mismatch';

export function freshnessOf(p: QtProvider, fetchedSeoul: string, nowSeoul: string): Freshness {
  if (p.availabilityStatus !== 'RANGE_CONFIRMED' || !p.passage || !p.providerDate) return 'n/a';
  if (p.providerDate < fetchedSeoul) return 'mismatch';
  if (fetchedSeoul < nowSeoul) return 'checking';
  return 'fresh';
}

/** 카드에 그릴 제공처와 "재확인 중" 여부. mismatch는 계약의 DATE_MISMATCH와 같은 모양으로 내린다. */
export function applyFreshness(
  p: QtProvider,
  fetchedSeoul: string,
  nowSeoul: string,
): { provider: QtProvider; checking: boolean } {
  const f = freshnessOf(p, fetchedSeoul, nowSeoul);
  if (f === 'mismatch') {
    return {
      provider: {
        ...p,
        availabilityStatus: 'RANGE_UNAVAILABLE',
        reasonCode: 'DATE_MISMATCH',
        passage: null,
        displayReference: null,
        providerDate: null,
        verifiedAt: null,
        notice: null,
      },
      checking: false,
    };
  }
  return { provider: p, checking: f === 'checking' };
}
