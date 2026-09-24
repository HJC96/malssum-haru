import type { BibleData } from '../domain/types';

/**
 * 테스트·개발용 작은 데이터(dataVersion 'sample-0').
 * bookId와 order는 정경 순서를 따르지만 절 수는 일부러 실제와 다르게 만든 가짜 값이다.
 * 실제 66권 데이터가 아니며 화면 표시나 계획 결과의 근거로 쓰지 않는다. 실제 데이터는 T10에서 반영한다.
 * 일부러 절 수가 불균등하게 잡아 두었다(PSA 3장은 다른 장보다 훨씬 길다).
 */
export const SAMPLE_BIBLE: BibleData = {
  dataVersion: 'sample-0',
  versificationSystem: 'sample-synthetic-not-real',
  books: [
    { bookId: 'GEN', testament: 'OT', order: 1, chapterVerseCounts: [12, 3, 20, 5, 9] },
    { bookId: 'PSA', testament: 'OT', order: 19, chapterVerseCounts: [6, 2, 40] },
    { bookId: 'OBA', testament: 'OT', order: 31, chapterVerseCounts: [7] },
    { bookId: 'MAT', testament: 'NT', order: 40, chapterVerseCounts: [10, 4, 17] },
    { bookId: 'JHN', testament: 'NT', order: 43, chapterVerseCounts: [5, 25, 2] },
  ],
};
