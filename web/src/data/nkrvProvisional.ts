// 이 파일은 web/src/data/tools/generate_nkrv_provisional.py 가 생성한다. 손으로 고치지 않는다.
//
// 잠정(provisional) 장절 구조 데이터: 개역개정 전수 미검증. 개역개정과 일치한다고 확정된 값이 아니다.
// 표본 확인에서 다른 지점은 REV 12장(18 -> 17) 한 곳뿐이었고 그 외 장은 검증하지 않았다.
// 사도행전 15:25-26(병합 표시), 24:7(개역개정에 없는 번호) 같은 절 번호는 번호 기준으로 센다(알려진 제한).
//
// 출처: UBS(United Bible Societies) versification_json 저장소의 examples/eng.vrs (Paratext English versification)
//   https://github.com/ubsicap/versification_json  commit 71c66cb6ddfa6158919bc9798d124141a8168b14
//   원본 18787 바이트, SHA-256 003981c7f43c69b73b60d40a3f35f72e7ee017a686a6fb206f19a1b721157541
//   수정: REV 12장 절 수를 18에서 17로 덮어씀. 라이선스(MIT)는 web/src/data/THIRD_PARTY_NOTICES.md 참조.
// 검증값: 66권 1,189장 31,103절(구약 23,145, 신약 7,958). 정규 문자열 SHA-256은 아래 상수.
// SWORD KJV canon과의 차이는 3JN 1장(15 대 14) 한 곳뿐이다.

import type { BibleData } from '../domain/types';

export const NKRV_PROVISIONAL_SOURCE_COMMIT = '71c66cb6ddfa6158919bc9798d124141a8168b14';
export const NKRV_PROVISIONAL_SOURCE_SHA256 = '003981c7f43c69b73b60d40a3f35f72e7ee017a686a6fb206f19a1b721157541';
export const NKRV_PROVISIONAL_CANONICAL_SHA256 = '06d08cd442227dab417f059804dc042a9039f4decd8ed7c4b69385721e55e3b5';

export const NKRV_PROVISIONAL: BibleData = {
  dataVersion: 'eng.vrs@71c66cb+REV12=17',
  versificationSystem: 'nkrv-provisional-1',
  books: [
    { bookId: 'GEN', testament: 'OT', order: 1, chapterVerseCounts: [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26] },
    { bookId: 'EXO', testament: 'OT', order: 2, chapterVerseCounts: [22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38] },
    { bookId: 'LEV', testament: 'OT', order: 3, chapterVerseCounts: [17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34] },
    { bookId: 'NUM', testament: 'OT', order: 4, chapterVerseCounts: [54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32, 22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13] },
    { bookId: 'DEU', testament: 'OT', order: 5, chapterVerseCounts: [46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22, 21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12] },
    { bookId: 'JOS', testament: 'OT', order: 6, chapterVerseCounts: [18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16, 33] },
    { bookId: 'JDG', testament: 'OT', order: 7, chapterVerseCounts: [36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25] },
    { bookId: 'RUT', testament: 'OT', order: 8, chapterVerseCounts: [22, 23, 18, 22] },
    { bookId: '1SA', testament: 'OT', order: 9, chapterVerseCounts: [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 42, 15, 23, 29, 22, 44, 25, 12, 25, 11, 31, 13] },
    { bookId: '2SA', testament: 'OT', order: 10, chapterVerseCounts: [27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33, 43, 26, 22, 51, 39, 25] },
    { bookId: '1KI', testament: 'OT', order: 11, chapterVerseCounts: [53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 53] },
    { bookId: '2KI', testament: 'OT', order: 12, chapterVerseCounts: [18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37, 20, 30] },
    { bookId: '1CH', testament: 'OT', order: 13, chapterVerseCounts: [54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30] },
    { bookId: '2CH', testament: 'OT', order: 14, chapterVerseCounts: [17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34, 11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23] },
    { bookId: 'EZR', testament: 'OT', order: 15, chapterVerseCounts: [11, 70, 13, 24, 17, 22, 28, 36, 15, 44] },
    { bookId: 'NEH', testament: 'OT', order: 16, chapterVerseCounts: [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31] },
    { bookId: 'EST', testament: 'OT', order: 17, chapterVerseCounts: [22, 23, 15, 17, 14, 14, 10, 17, 32, 3] },
    { bookId: 'JOB', testament: 'OT', order: 18, chapterVerseCounts: [22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 24, 34, 17] },
    { bookId: 'PSA', testament: 'OT', order: 19, chapterVerseCounts: [6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6] },
    { bookId: 'PRO', testament: 'OT', order: 20, chapterVerseCounts: [33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31] },
    { bookId: 'ECC', testament: 'OT', order: 21, chapterVerseCounts: [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14] },
    { bookId: 'SNG', testament: 'OT', order: 22, chapterVerseCounts: [17, 17, 11, 16, 16, 13, 13, 14] },
    { bookId: 'ISA', testament: 'OT', order: 23, chapterVerseCounts: [31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24] },
    { bookId: 'JER', testament: 'OT', order: 24, chapterVerseCounts: [19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34] },
    { bookId: 'LAM', testament: 'OT', order: 25, chapterVerseCounts: [22, 22, 66, 22, 22] },
    { bookId: 'EZK', testament: 'OT', order: 26, chapterVerseCounts: [28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35] },
    { bookId: 'DAN', testament: 'OT', order: 27, chapterVerseCounts: [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13] },
    { bookId: 'HOS', testament: 'OT', order: 28, chapterVerseCounts: [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9] },
    { bookId: 'JOL', testament: 'OT', order: 29, chapterVerseCounts: [20, 32, 21] },
    { bookId: 'AMO', testament: 'OT', order: 30, chapterVerseCounts: [15, 16, 15, 13, 27, 14, 17, 14, 15] },
    { bookId: 'OBA', testament: 'OT', order: 31, chapterVerseCounts: [21] },
    { bookId: 'JON', testament: 'OT', order: 32, chapterVerseCounts: [17, 10, 10, 11] },
    { bookId: 'MIC', testament: 'OT', order: 33, chapterVerseCounts: [16, 13, 12, 13, 15, 16, 20] },
    { bookId: 'NAM', testament: 'OT', order: 34, chapterVerseCounts: [15, 13, 19] },
    { bookId: 'HAB', testament: 'OT', order: 35, chapterVerseCounts: [17, 20, 19] },
    { bookId: 'ZEP', testament: 'OT', order: 36, chapterVerseCounts: [18, 15, 20] },
    { bookId: 'HAG', testament: 'OT', order: 37, chapterVerseCounts: [15, 23] },
    { bookId: 'ZEC', testament: 'OT', order: 38, chapterVerseCounts: [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21] },
    { bookId: 'MAL', testament: 'OT', order: 39, chapterVerseCounts: [14, 17, 18, 6] },
    { bookId: 'MAT', testament: 'NT', order: 40, chapterVerseCounts: [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20] },
    { bookId: 'MRK', testament: 'NT', order: 41, chapterVerseCounts: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20] },
    { bookId: 'LUK', testament: 'NT', order: 42, chapterVerseCounts: [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53] },
    { bookId: 'JHN', testament: 'NT', order: 43, chapterVerseCounts: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25] },
    { bookId: 'ACT', testament: 'NT', order: 44, chapterVerseCounts: [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35, 27, 27, 32, 44, 31] },
    { bookId: 'ROM', testament: 'NT', order: 45, chapterVerseCounts: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27] },
    { bookId: '1CO', testament: 'NT', order: 46, chapterVerseCounts: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24] },
    { bookId: '2CO', testament: 'NT', order: 47, chapterVerseCounts: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14] },
    { bookId: 'GAL', testament: 'NT', order: 48, chapterVerseCounts: [24, 21, 29, 31, 26, 18] },
    { bookId: 'EPH', testament: 'NT', order: 49, chapterVerseCounts: [23, 22, 21, 32, 33, 24] },
    { bookId: 'PHP', testament: 'NT', order: 50, chapterVerseCounts: [30, 30, 21, 23] },
    { bookId: 'COL', testament: 'NT', order: 51, chapterVerseCounts: [29, 23, 25, 18] },
    { bookId: '1TH', testament: 'NT', order: 52, chapterVerseCounts: [10, 20, 13, 18, 28] },
    { bookId: '2TH', testament: 'NT', order: 53, chapterVerseCounts: [12, 17, 18] },
    { bookId: '1TI', testament: 'NT', order: 54, chapterVerseCounts: [20, 15, 16, 16, 25, 21] },
    { bookId: '2TI', testament: 'NT', order: 55, chapterVerseCounts: [18, 26, 17, 22] },
    { bookId: 'TIT', testament: 'NT', order: 56, chapterVerseCounts: [16, 15, 15] },
    { bookId: 'PHM', testament: 'NT', order: 57, chapterVerseCounts: [25] },
    { bookId: 'HEB', testament: 'NT', order: 58, chapterVerseCounts: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25] },
    { bookId: 'JAS', testament: 'NT', order: 59, chapterVerseCounts: [27, 26, 18, 17, 20] },
    { bookId: '1PE', testament: 'NT', order: 60, chapterVerseCounts: [25, 25, 22, 19, 14] },
    { bookId: '2PE', testament: 'NT', order: 61, chapterVerseCounts: [21, 22, 18] },
    { bookId: '1JN', testament: 'NT', order: 62, chapterVerseCounts: [10, 29, 24, 21, 21] },
    { bookId: '2JN', testament: 'NT', order: 63, chapterVerseCounts: [13] },
    { bookId: '3JN', testament: 'NT', order: 64, chapterVerseCounts: [15] },
    { bookId: 'JUD', testament: 'NT', order: 65, chapterVerseCounts: [25] },
    { bookId: 'REV', testament: 'NT', order: 66, chapterVerseCounts: [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21] },
  ],
};
