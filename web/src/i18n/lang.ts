export type Lang = 'ko' | 'en';

export const LANGS: readonly Lang[] = ['ko', 'en'];

/** 브라우저 언어 목록에서 초기 UI 언어를 고른다. 한국어가 아니면 영어. 저장하지 않는다. */
export function detectLang(languages: readonly string[] | undefined): Lang {
  const first = languages?.[0]?.toLowerCase() ?? 'ko';
  return first.startsWith('ko') ? 'ko' : 'en';
}
