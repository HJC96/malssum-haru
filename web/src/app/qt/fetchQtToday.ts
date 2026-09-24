import { localIsoDate } from '@/i18n/format';
import { QT_MOCK_SCENARIOS, type QtMockScenario } from './fixtures';
import { durannoDateUrl, MAEIL_TODAY_URL } from './officialLinks';
import { normalizeQtToday, QtResponseError } from './normalize';
import type { QtTodayResponse } from './types';

export interface FetchQtTodayOptions {
  signal?: AbortSignal;
  /** 'mock'(기본, 지금) | 'api'(`/api/qt/today`). 미지정이면 VITE_QT_SOURCE를 따른다. */
  source?: 'mock' | 'api';
  mockScenario?: QtMockScenario;
  /** 테스트용 fetch 주입. */
  fetchImpl?: typeof fetch;
}

export const QT_TODAY_PATH = '/api/qt/today';

function resolveSource(explicit: FetchQtTodayOptions['source']): 'mock' | 'api' {
  if (explicit) return explicit;
  return import.meta.env.VITE_QT_SOURCE === 'api' ? 'api' : 'mock';
}

function resolveScenario(explicit: QtMockScenario | undefined): QtMockScenario {
  const fromEnv = import.meta.env.VITE_QT_MOCK_SCENARIO;
  if (explicit) return explicit;
  return fromEnv && fromEnv in QT_MOCK_SCENARIOS ? (fromEnv as QtMockScenario) : 'mixed';
}

/**
 * 오늘 QT 상태를 계약 v1 형식으로 가져온다.
 * - 요청에는 쿼리·본문·쿠키가 없다. 개인 계획·읽은 범위는 이 모듈에 들어오지 않는다.
 * - 실패(네트워크·HTTP 오류·형식 오류)는 reject로 알리고, 화면이 QT 영역만 오류로 처리한다.
 */
export async function fetchQtToday(options: FetchQtTodayOptions = {}): Promise<QtTodayResponse> {
  if (resolveSource(options.source) === 'mock') {
    return normalizeQtToday(QT_MOCK_SCENARIOS[resolveScenario(options.mockScenario)]());
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
  ];
}
