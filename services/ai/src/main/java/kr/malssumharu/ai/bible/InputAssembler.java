package kr.malssumharu.ai.bible;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import kr.malssumharu.ai.bible.GenerationInput.InputVerse;
import kr.malssumharu.ai.bible.GenerationInput.Role;
import kr.malssumharu.ai.domain.RangeSet;
import kr.malssumharu.ai.domain.VerseRange;
import kr.malssumharu.ai.domain.VerseRef;

/** 정렬이 검증된 범위에서 LLM 입력(범위 절 + 앞뒤 문맥 절)과 그 해시를 만든다. */
public final class InputAssembler {

    private final WebBible web;
    private final AlignmentPolicy alignment;
    private final int contextVerses;

    public InputAssembler(WebBible web, AlignmentPolicy alignment, int contextVerses) {
        this.web = web;
        this.alignment = alignment;
        this.contextVerses = contextVerses;
    }

    public int contextVerses() {
        return contextVerses;
    }

    /** {@code passageVerses} 는 AlignmentPolicy.check 가 돌려준 범위 절(정렬 검증 통과분). */
    public GenerationInput assemble(RangeSet passage, List<VerseRef> passageVerses) {
        Map<VerseRef, InputVerse> ordered = new LinkedHashMap<>();
        TreeSet<VerseRef> sorted = new TreeSet<>(passageVerses);
        Set<VerseRef> inPassage = Set.copyOf(sorted);
        TreeSet<VerseRef> all = new TreeSet<>(sorted);
        for (VerseRange r : passage.ranges()) {
            all.addAll(walk(r.start(), -1, inPassage));
            all.addAll(walk(r.end(), +1, inPassage));
        }
        for (VerseRef ref : all) {
            Role role = inPassage.contains(ref) ? Role.PASSAGE : Role.CONTEXT;
            ordered.put(ref, new InputVerse(ref, role, web.verseText(ref.bookId(), ref.chapter(), ref.verse()).orElseThrow()));
        }
        List<InputVerse> verses = new ArrayList<>(ordered.values());
        return new GenerationInput(passage, List.copyOf(verses), Set.copyOf(ordered.keySet()), hash(verses));
    }

    /** from 에서 dir 방향으로 최대 contextVerses 절. 본문이 없거나 구조가 다른 장, 다른 범위 절을 만나면 멈춘다. */
    private List<VerseRef> walk(VerseRef from, int dir, Set<VerseRef> inPassage) {
        List<VerseRef> out = new ArrayList<>();
        VerseRef cur = from;
        while (out.size() < contextVerses) {
            cur = step(cur, dir);
            if (cur == null) {
                break;
            }
            if (alignment.isStructureDifferent(cur.bookId(), cur.chapter())) {
                break;
            }
            var text = web.verseText(cur.bookId(), cur.chapter(), cur.verse());
            if (text.isEmpty() || text.get().isBlank()) {
                break;
            }
            if (inPassage.contains(cur)) {
                break; // 다른 범위(비연속 범위의 다음 조각)에 닿으면 문맥은 거기서 끝
            }
            out.add(cur);
        }
        return out;
    }

    private VerseRef step(VerseRef r, int dir) {
        int v = r.verse() + dir;
        if (dir > 0) {
            var max = web.maxVerse(r.bookId(), r.chapter());
            if (max.isPresent() && v <= max.getAsInt()) {
                return new VerseRef(r.bookId(), r.chapter(), v);
            }
            var chapters = web.chapterCount(r.bookId());
            if (chapters.isPresent() && r.chapter() + 1 <= chapters.getAsInt()) {
                return new VerseRef(r.bookId(), r.chapter() + 1, 1);
            }
            return null;
        }
        if (v >= 1) {
            return new VerseRef(r.bookId(), r.chapter(), v);
        }
        if (r.chapter() > 1) {
            var max = web.maxVerse(r.bookId(), r.chapter() - 1);
            return max.isPresent() ? new VerseRef(r.bookId(), r.chapter() - 1, max.getAsInt()) : null;
        }
        return null;
    }

    static String hash(List<InputVerse> verses) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (InputVerse v : verses) {
                md.update((v.ref() + "\t" + v.role() + "\t" + v.text().length() + "\t" + v.text() + "\n").getBytes(StandardCharsets.UTF_8));
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
