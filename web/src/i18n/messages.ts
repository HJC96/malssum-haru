import type { Lang } from './lang';
import { enPlan, koPlan } from './messagesPlan';

/**
 * UI 문자열 딕셔너리. 키는 두 언어가 같아야 한다(타입으로 강제, 테스트로 재확인).
 * `{name}` 자리표시자는 t(key, { name })으로 채운다.
 */
const ko = {
  'app.title': '말씀하루',
  'app.skipToMain': '본문으로 건너뛰기',
  'app.services.label': '서비스 선택',
  'app.services.qt': '오늘의 QT',
  'app.services.plan': '일독 계획',
  'app.notices.open': '데이터 출처·라이선스',
  'app.notices.title': '데이터 출처와 라이선스',
  'app.notices.intro': '성경 장·절 수 데이터의 출처와 라이선스 고지입니다(원문 그대로 표시).',
  'app.notices.close': '닫기',
  'app.notices.loadError': '고지 문서를 불러오지 못했습니다.',
  'lang.label': '언어',
  'lang.ko': '한국어',
  'lang.en': 'English',

  'qt.heading': '오늘의 QT',
  'qt.intro': '각 QT 서비스의 오늘 장절 범위와 공식 링크입니다. 본문은 이 사이트에서 제공하지 않으며 제공처 페이지에서 읽을 수 있습니다.',
  'qt.independent': 'QT를 열어 보는 것은 일독 계획의 배정 범위나 진도에 반영되지 않습니다.',
  'qt.loading': 'QT 정보를 불러오는 중입니다.',
  'qt.loadError.title': 'QT 정보를 불러오지 못했습니다',
  'qt.loadError.body': '일독 계획 계산은 그대로 사용할 수 있습니다. 아래 공식 링크로 오늘 범위를 직접 확인하거나 다시 시도해 주세요.',
  'qt.loadError.renderBody': 'QT 영역에 문제가 생겼습니다. 일독 계획 계산에는 영향이 없습니다.',
  'qt.retry': '다시 시도',
  'qt.fallback.note': '서버에서 오늘 범위를 확인하지 못해 기본 링크만 보여 드립니다. 범위는 표시하지 않습니다.',

  'qt.provider.label': '제공처',
  'qt.date.label': '제공처 기준 날짜',
  'qt.date.kst': '한국 시간 기준',
  'qt.date.unknown': '날짜를 확인하지 못했습니다',
  'qt.date.localDiffers': '내 지역의 오늘 날짜({localDate})와 다를 수 있습니다. 위 날짜는 제공처 기준입니다.',
  'qt.passage.label': '오늘의 범위',
  'qt.passage.inKorean': '한국어 표기',
  'qt.passage.sourceKorean': '제공처의 원문은 한국어입니다.',
  'qt.body.notProvided': '본문은 이 사이트에서 제공하지 않습니다. 제공처 페이지에서 읽어 주세요.',

  'qt.status.RANGE_CONFIRMED.badge': '범위 확인됨',
  'qt.status.RANGE_UNAVAILABLE.badge': '범위 확인 못함',
  'qt.status.RANGE_NOT_PERMITTED.badge': '자동 확인 안 함',
  'qt.status.LINK_ERROR.badge': '링크 오류',
  'qt.status.DISABLED.badge': '연동 중지',
  'qt.status.UNKNOWN.badge': '상태 확인 못함',
  'qt.status.CHECKING.badge': '다시 확인 중',
  'qt.status.CHECKING.body': '날짜가 바뀌어 오늘 범위를 다시 확인하는 중입니다. 이전 범위는 오늘 것이 아니라서 표시하지 않습니다.',
  'qt.mockBanner': '개발용 샘플 데이터입니다. 실제 오늘 범위가 아닙니다.',
  'qt.link.date': '링크의 날짜: {date}',

  'qt.status.RANGE_UNAVAILABLE.body': '오늘 범위를 확인하지 못했습니다. 범위를 추정하지 않으니 공식 페이지에서 확인해 주세요.',
  'qt.status.RANGE_NOT_PERMITTED.body': '이 제공처의 오늘 범위는 자동으로 가져오지 않습니다. 공식 페이지에서 확인해 주세요.',
  'qt.status.LINK_ERROR.body': '공식 링크가 응답하지 않는 것으로 확인되었습니다. 링크를 눌러 직접 확인해 보실 수 있습니다.',
  'qt.status.DISABLED.body': '이 제공처 연동은 현재 사용하지 않습니다. 공식 페이지에서 확인해 주세요.',
  'qt.status.UNKNOWN.body': '오늘 범위를 확인하지 못했습니다. 공식 페이지에서 확인해 주세요.',
  'qt.status.noLink': '공식 링크를 확인하지 못했습니다.',

  'qt.reason.DATE_MISMATCH': '제공처가 표시한 날짜가 오늘과 달라 그 자료를 사용하지 않았습니다.',
  'qt.reason.UPSTREAM_TIMEOUT': '제공처의 응답이 늦어 확인하지 못했습니다.',
  'qt.reason.UPSTREAM_HTTP_ERROR': '제공처가 오류를 응답해 확인하지 못했습니다.',
  'qt.reason.PARSE_FAILED': '제공처 화면의 형식을 읽지 못했습니다.',
  'qt.reason.INVALID_REFERENCE': '확인된 장절이 올바르지 않아 표시하지 않았습니다.',
  'qt.reason.NOT_COLLECTED_YET': '오늘 범위를 아직 가져오지 못했습니다.',
  'qt.reason.INTERNAL_ERROR': '서버 내부 오류로 확인하지 못했습니다.',

  'qt.link.go': '{provider} 공식 페이지로 이동',
  'qt.link.newTab': '(새 창에서 열림)',
  'qt.link.external': '제공처의 외부 사이트로 이동합니다.',
  'qt.link.kind.today-page': '제공처의 오늘 페이지로 연결됩니다. 날짜가 바뀌면 보이는 내용이 달라질 수 있습니다.',
  'qt.link.kind.date-specific': '제공처가 그 날짜에 게시한 페이지로 연결됩니다.',

  ...koPlan,
} as const;

export type MessageKey = keyof typeof ko;

const en: Record<MessageKey, string> = {
  'app.title': 'Malssum Haru',
  'app.skipToMain': 'Skip to main content',
  'app.services.label': 'Choose a service',
  'app.services.qt': "Today's QT",
  'app.services.plan': 'Reading plan',
  'app.notices.open': 'Data sources and licenses',
  'app.notices.title': 'Data sources and licenses',
  'app.notices.intro': 'Sources and license notices for the chapter and verse count data (shown as written).',
  'app.notices.close': 'Close',
  'app.notices.loadError': 'Could not load the notices.',
  'lang.label': 'Language',
  'lang.ko': '한국어',
  'lang.en': 'English',

  'qt.heading': "Today's QT",
  'qt.intro': "Today's passage range and the official link for each QT service. This site does not show the text; read it on the provider's own page.",
  'qt.independent': 'Opening a QT page does not change your reading plan assignments or progress.',
  'qt.loading': 'Loading QT information.',
  'qt.loadError.title': 'Could not load QT information',
  'qt.loadError.body': "The reading plan calculator still works. Check today's passage on the official links below, or try again.",
  'qt.loadError.renderBody': 'Something went wrong in the QT area. The reading plan calculator is not affected.',
  'qt.retry': 'Try again',
  'qt.fallback.note': "We could not confirm today's passage from the server, so only default links are shown. No passage is displayed.",

  'qt.provider.label': 'Provider',
  'qt.date.label': "Provider's date",
  'qt.date.kst': 'Korea time (KST)',
  'qt.date.unknown': 'The date could not be confirmed',
  'qt.date.localDiffers': "This may differ from today's date where you are ({localDate}). The date above is the provider's.",
  'qt.passage.label': "Today's passage",
  'qt.passage.inKorean': 'In Korean',
  'qt.passage.sourceKorean': "The provider's text is in Korean only.",
  'qt.body.notProvided': "This site does not show the text. Read it on the provider's page.",

  'qt.status.RANGE_CONFIRMED.badge': 'Range confirmed',
  'qt.status.RANGE_UNAVAILABLE.badge': 'Range not confirmed',
  'qt.status.RANGE_NOT_PERMITTED.badge': 'Not fetched automatically',
  'qt.status.LINK_ERROR.badge': 'Link error',
  'qt.status.DISABLED.badge': 'Turned off',
  'qt.status.UNKNOWN.badge': 'Status unknown',
  'qt.status.CHECKING.badge': 'Checking again',
  'qt.status.CHECKING.body': "The date has changed, so today's passage is being checked again. The earlier passage is not today's, so it is not shown.",
  'qt.mockBanner': "This is sample data for development. It is not today's actual passage.",
  'qt.link.date': 'Date of the link: {date}',

  'qt.status.RANGE_UNAVAILABLE.body': "We could not confirm today's passage. We do not guess it, so please check the official page.",
  'qt.status.RANGE_NOT_PERMITTED.body': "Today's passage for this provider is not fetched automatically. Please check the official page.",
  'qt.status.LINK_ERROR.body': 'The official link appears not to be responding. You can still open it to check for yourself.',
  'qt.status.DISABLED.body': 'This provider is currently turned off here. Please check the official page.',
  'qt.status.UNKNOWN.body': "We could not confirm today's passage. Please check the official page.",
  'qt.status.noLink': 'The official link could not be confirmed.',

  'qt.reason.DATE_MISMATCH': "The provider's page showed a date other than today, so that material was not used.",
  'qt.reason.UPSTREAM_TIMEOUT': "The provider took too long to respond.",
  'qt.reason.UPSTREAM_HTTP_ERROR': 'The provider returned an error.',
  'qt.reason.PARSE_FAILED': "We could not read the provider's page format.",
  'qt.reason.INVALID_REFERENCE': 'The reported passage was invalid, so it is not shown.',
  'qt.reason.NOT_COLLECTED_YET': "Today's passage has not been collected yet.",
  'qt.reason.INTERNAL_ERROR': 'A server error prevented us from confirming it.',

  'qt.link.go': 'Go to {provider} official page',
  'qt.link.newTab': '(opens in a new tab)',
  'qt.link.external': "This takes you to the provider's external site.",
  'qt.link.kind.today-page': "This links to the provider's page for today. What it shows may change when the date changes.",
  'qt.link.kind.date-specific': "This links to the page the provider published for that date.",

  ...enPlan,
};

export const MESSAGES: Readonly<Record<Lang, Readonly<Record<MessageKey, string>>>> = { ko, en };

export type TranslateParams = Record<string, string | number>;

export function translate(lang: Lang, key: MessageKey, params?: TranslateParams): string {
  const template = MESSAGES[lang][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export function isMessageKey(key: string): key is MessageKey {
  return key in ko;
}
