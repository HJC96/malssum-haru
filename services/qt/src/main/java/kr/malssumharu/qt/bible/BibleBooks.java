package kr.malssumharu.qt.bible;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 66권의 USFM bookId와 한국어 책 이름·약칭. 순서가 곧 성경 순서(개신교 정경)다.
 * 이름은 개역개정 표기와 두 제공처·대한성서공회 등에서 흔한 약칭·표기 변형이다.
 */
public final class BibleBooks {

    private record Entry(String id, String fullName, String... aliases) {
    }

    private static final List<Entry> ENTRIES = List.of(
            new Entry("GEN", "창세기", "창"),
            new Entry("EXO", "출애굽기", "출", "출애급기"),
            new Entry("LEV", "레위기", "레"),
            new Entry("NUM", "민수기", "민"),
            new Entry("DEU", "신명기", "신"),
            new Entry("JOS", "여호수아", "수"),
            new Entry("JDG", "사사기", "삿"),
            new Entry("RUT", "룻기", "룻"),
            new Entry("1SA", "사무엘상", "삼상", "사무엘상서", "사무엘1서", "사무엘기상"),
            new Entry("2SA", "사무엘하", "삼하", "사무엘하서", "사무엘2서", "사무엘기하"),
            new Entry("1KI", "열왕기상", "왕상", "열왕기1서"),
            new Entry("2KI", "열왕기하", "왕하", "열왕기2서"),
            new Entry("1CH", "역대상", "대상", "역대기상", "역대1서"),
            new Entry("2CH", "역대하", "대하", "역대기하", "역대2서"),
            new Entry("EZR", "에스라", "스"),
            new Entry("NEH", "느헤미야", "느"),
            new Entry("EST", "에스더", "에", "에스터"),
            new Entry("JOB", "욥기", "욥"),
            new Entry("PSA", "시편", "시"),
            new Entry("PRO", "잠언", "잠"),
            new Entry("ECC", "전도서", "전"),
            new Entry("SNG", "아가", "아", "아가서"),
            new Entry("ISA", "이사야", "사", "이사야서"),
            new Entry("JER", "예레미야", "렘", "예레미야서"),
            new Entry("LAM", "예레미야애가", "애", "애가"),
            new Entry("EZK", "에스겔", "겔", "에스겔서"),
            new Entry("DAN", "다니엘", "단", "다니엘서"),
            new Entry("HOS", "호세아", "호", "호세아서"),
            new Entry("JOL", "요엘", "욜", "요엘서"),
            new Entry("AMO", "아모스", "암", "아모스서"),
            new Entry("OBA", "오바댜", "옵", "오바댜서"),
            new Entry("JON", "요나", "욘", "요나서"),
            new Entry("MIC", "미가", "미", "미가서"),
            new Entry("NAM", "나훔", "나", "나훔서"),
            new Entry("HAB", "하박국", "합", "하박국서"),
            new Entry("ZEP", "스바냐", "습", "스바냐서"),
            new Entry("HAG", "학개", "학", "학개서"),
            new Entry("ZEC", "스가랴", "슥", "스가랴서"),
            new Entry("MAL", "말라기", "말", "말라기서"),
            new Entry("MAT", "마태복음", "마", "마태"),
            new Entry("MRK", "마가복음", "막", "마가"),
            new Entry("LUK", "누가복음", "눅", "누가"),
            new Entry("JHN", "요한복음", "요", "요한"),
            new Entry("ACT", "사도행전", "행"),
            new Entry("ROM", "로마서", "롬"),
            new Entry("1CO", "고린도전서", "고전", "고린도1서"),
            new Entry("2CO", "고린도후서", "고후", "고린도2서"),
            new Entry("GAL", "갈라디아서", "갈"),
            new Entry("EPH", "에베소서", "엡"),
            new Entry("PHP", "빌립보서", "빌"),
            new Entry("COL", "골로새서", "골"),
            new Entry("1TH", "데살로니가전서", "살전", "데살로니가1서"),
            new Entry("2TH", "데살로니가후서", "살후", "데살로니가2서"),
            new Entry("1TI", "디모데전서", "딤전", "디모데1서"),
            new Entry("2TI", "디모데후서", "딤후", "디모데2서"),
            new Entry("TIT", "디도서", "딛"),
            new Entry("PHM", "빌레몬서", "몬"),
            new Entry("HEB", "히브리서", "히"),
            new Entry("JAS", "야고보서", "약"),
            new Entry("1PE", "베드로전서", "벧전", "베드로1서"),
            new Entry("2PE", "베드로후서", "벧후", "베드로2서"),
            new Entry("1JN", "요한일서", "요일", "요한1서"),
            new Entry("2JN", "요한이서", "요이", "요한2서"),
            new Entry("3JN", "요한삼서", "요삼", "요한3서"),
            new Entry("JUD", "유다서", "유"),
            new Entry("REV", "요한계시록", "계", "계시록"));

    private static final Map<String, String> ALIAS_TO_ID = new HashMap<>();
    private static final Map<String, Integer> ORDER = new HashMap<>();
    private static final List<String> IDS = new ArrayList<>();

    static {
        for (int i = 0; i < ENTRIES.size(); i++) {
            Entry e = ENTRIES.get(i);
            IDS.add(e.id());
            ORDER.put(e.id(), i);
            ALIAS_TO_ID.put(e.fullName(), e.id());
            for (String alias : e.aliases()) {
                ALIAS_TO_ID.put(alias, e.id());
            }
        }
    }

    private BibleBooks() {
    }

    /** 공백·괄호 병기(예: "사사기(Judges)")를 무시하고 책 이름·약칭을 bookId로 바꾼다. */
    public static Optional<String> findId(String name) {
        if (name == null) {
            return Optional.empty();
        }
        String key = name.replaceAll("\\(.*?\\)", "").replaceAll("\\s+", "");
        return Optional.ofNullable(ALIAS_TO_ID.get(key));
    }

    public static int order(String bookId) {
        Integer o = ORDER.get(bookId);
        if (o == null) {
            throw new IllegalArgumentException("unknown bookId");
        }
        return o;
    }

    public static List<String> allIds() {
        return List.copyOf(IDS);
    }
}
