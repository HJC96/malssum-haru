package kr.malssumharu.ai.bible;

import java.util.List;

/** 개신교 66권 USFM 코드(성경 순서). QT 서비스와 코드를 공유하지 않고 계약(bookId)만 맞춘다. */
public final class BibleBooks {

    public static final List<String> IDS = List.of(
            "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH",
            "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON",
            "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL",
            "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN",
            "JUD", "REV");

    private BibleBooks() {
    }

    public static boolean isKnown(String bookId) {
        return IDS.contains(bookId);
    }

    /** 성경 순서(0부터). 모르는 책은 예외. */
    public static int order(String bookId) {
        int i = IDS.indexOf(bookId);
        if (i < 0) {
            throw new IllegalArgumentException("unknown bookId");
        }
        return i;
    }
}
