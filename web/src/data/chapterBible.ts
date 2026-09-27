import type { BibleData } from '../domain/types';
import { NKRV_PROVISIONAL } from './nkrvProvisional';

/**
 * 기본 성경 읽기 계획은 책과 장만 배정한다. 각 장을 한 단위로 두므로
 * 번역본마다 다른 절 번호나 절 수가 계산 결과에 들어가지 않는다.
 * 66권의 순서와 장 수만 기존 공개 구조표에서 가져온다.
 */
export const CHAPTER_BIBLE: BibleData = {
  dataVersion: '66books-1189chapters-1',
  versificationSystem: 'chapter-only-66',
  books: NKRV_PROVISIONAL.books.map((book) => ({
    ...book,
    chapterVerseCounts: book.chapterVerseCounts.map(() => 1),
  })),
};
