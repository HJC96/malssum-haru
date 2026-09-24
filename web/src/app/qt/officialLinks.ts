/**
 * 폴백 전용 공식 링크 상수.
 *
 * `/api/qt/today`가 실패했을 때 화면이 범위 없이 보여 주는 링크이며, 정상 경로의 링크는 항상 서버 응답의
 * `officialUrl`을 쓴다. URL 형식은 docs/contracts/qt-today.md의 예시와 같아야 한다(officialLinks.test.ts).
 */
export const MAEIL_TODAY_URL = 'https://sum.su.or.kr:8888/bible/today';

export const durannoDateUrl = (isoDate: string) =>
  `https://www.duranno.com/qt/view/bible.asp?qtDate=${isoDate}`;
