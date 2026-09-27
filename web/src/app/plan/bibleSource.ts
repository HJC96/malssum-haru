import { bibleDataStatus, DEFAULT_BIBLE, type BibleData } from '@/domain';
import { CHAPTER_BIBLE } from '@/data/chapterBible';

/**
 * 절 수 기준은 잠정 장절표, 기본 장 단위 계획은 절 번호가 없는 구조표를 쓴다.
 * SAMPLE_BIBLE은 테스트 전용이다.
 */
export const BIBLE: BibleData = DEFAULT_BIBLE;
export const CHAPTER_PLAN_BIBLE: BibleData = CHAPTER_BIBLE;

export type DataStatus = ReturnType<typeof bibleDataStatus>;
export const dataStatusOf = (bible: BibleData): DataStatus => bibleDataStatus(bible);
