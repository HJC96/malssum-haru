/**
 * Translation-use gate for production artifacts. A public-domain notice is evidence, not product selection;
 * enabling a translation here requires the user's choice plus W02 file/versification QA.
 */
interface TranslationPolicy {
  displayName: string;
  language: 'ko' | 'en';
  status: 'candidate' | 'approved';
  source: string;
  attribution?: string;
}

export const DAILY_WORD_TRANSLATIONS: Record<string, TranslationPolicy> = {
  'kor-rv-1961': {
    displayName: '개역한글',
    language: 'ko',
    status: 'approved',
    source: 'https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&wr_id=5',
    attribution: '성경전서 개역한글판 © 대한성서공회 1961',
  },
} as const;

export function translationDisplayName(translationId: string): string {
  return DAILY_WORD_TRANSLATIONS[translationId]?.displayName ?? translationId;
}

export function translationAttribution(translationId: string): string | null {
  return DAILY_WORD_TRANSLATIONS[translationId]?.attribution ?? null;
}

export function approvedTranslation(translationId: string): { displayName: string; language: 'ko' | 'en' } | null {
  const candidate = DAILY_WORD_TRANSLATIONS[translationId];
  if (!candidate || candidate.status !== 'approved') return null;
  return { displayName: candidate.displayName, language: candidate.language };
}
