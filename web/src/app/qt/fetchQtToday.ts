import { localIsoDate } from '@/i18n/format';
import type { QtMockScenario } from './fixtures';
import { durannoDateUrl, MAEIL_TODAY_URL } from './officialLinks';
import { normalizeQtToday, QtResponseError } from './normalize';
import type { QtTodayResponse } from './types';

export interface FetchQtTodayOptions {
  signal?: AbortSignal;
  /**
   * 'api'(`/api/qt/today`) | 'mock'(개발용 샘플). 미지정이면 `resolveQtSource`가 정한다.
   * 프로덕션 빌드에서는 mock을 요청해도 api로 처리한다(샘플 범위를 오늘 자료로 내보내지 않는다, F-01).
   */
  source?: 'mock' | 'api';
  mockScenario?: QtMockScenario;
  /** 테스트용 fetch 주입. */
  fetchImpl?: typeof fetch;
}

export const QT_TODAY_PATH = '/api/qt/today';

export interface QtSourceEnv {
  /** Vite 개발 서버(또는 vitest)에서만 true. 프로덕션 빌드에서는 false로 고정된다. */
  DEV: boolean;
  VITE_QT_SOURCE?: string | undefined;
}

/**
 * QT 데이터 출처. 프로덕션 빌드의 기본은 항상 'api'이고,
 * mock은 개발 서버이거나 빌드 때 VITE_QT_SOURCE=mock을 명시했을 때만 쓴다(F-01).
 */
export function resolveQtSource(explicit: FetchQtTodayOptions['source'], env: QtSourceEnv): 'mock' | 'api' {
  const mockAllowed = env.DEV || env.VITE_QT_SOURCE === 'mock';
  if (!mockAllowed) return 'api';
  if (explicit) return explicit;
  return env.VITE_QT_SOURCE === 'api' ? 'api' : 'mock';
}

const currentEnv = (): QtSourceEnv => ({
  DEV: import.meta.env.DEV,
  VITE_QT_SOURCE: import.meta.env.VITE_QT_SOURCE,
});

/**
 * 오늘 QT 상태를 계약 v1 형식으로 가져온다.
 * - 요청에는 쿼리·본문·쿠키가 없다. 개인 계획·읽은 범위는 이 모듈에 들어오지 않는다.
 * - 실패(네트워크·HTTP 오류·형식 오류)는 reject로 알리고, 화면이 QT 영역만 오류로 처리한다.
 */
export async function fetchQtToday(options: FetchQtTodayOptions = {}): Promise<QtTodayResponse> {
  // 앞의 정적 조건은 프로덕션 빌드에서 false로 접혀 fixture 청크가 산출물에서 빠진다.
  if ((import.meta.env.DEV || import.meta.env.VITE_QT_SOURCE === 'mock') && resolveQtSource(options.source, currentEnv()) === 'mock') {
    // fixture는 mock을 쓸 수 있는 빌드에서만 번들에 들어가도록 지연 import한다(프로덕션 산출물에는 없다).
    const { QT_MOCK_SCENARIOS } = await import('./fixtures');
    const fromEnv = import.meta.env.VITE_QT_MOCK_SCENARIO;
    const name: QtMockScenario =
      options.mockScenario ?? (fromEnv && fromEnv in QT_MOCK_SCENARIOS ? (fromEnv as QtMockScenario) : 'mixed');
    return { ...normalizeQtToday(QT_MOCK_SCENARIOS[name]()), origin: 'mock' };
  }

  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(QT_TODAY_PATH, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok) throw new QtResponseError(`QT API 응답 오류: HTTP ${res.status}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new QtResponseError('QT API 응답이 JSON이 아닙니다.');
  }
  return normalizeQtToday(json);
}

export interface FallbackLink {
  providerId: string;
  providerName: { ko: string; en: string };
  url: string;
  kind: 'today-page' | 'date-specific';
}

/**
 * API 전체가 실패했을 때 보여 주는 기본 공식 링크(PRD 5장의 공개 페이지). 범위는 포함하지 않는다.
 * 생명의삶 날짜는 제공처 기준(Asia/Seoul) 오늘이다.
 */
export function fallbackLinks(now: Date = new Date()): FallbackLink[] {
  return [
    {
      providerId: 'maeil-seongyeong',
      providerName: { ko: '매일성경', en: 'Maeil Seongyeong (Daily Bible)' },
      url: MAEIL_TODAY_URL,
      kind: 'today-page',
    },
    {
      providerId: 'saengmyeong-ui-sam',
      providerName: { ko: '생명의삶', en: 'Saengmyeong-ui-sam (Life Application QT)' },
      url: durannoDateUrl(localIsoDate(now, 'Asia/Seoul')),
      kind: 'date-specific',
    },
    {
      providerId: 'nal-som-sam',
      providerName: { ko: '날마다 솟는 샘물', en: 'NalMalsSam QT' },
      url: 'https://www.godpia.com/qt/qt.asp',
      kind: 'today-page',
    },
  ];
}
