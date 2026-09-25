package kr.malssumharu.ai.explain;

import java.util.List;
import kr.malssumharu.ai.domain.VerseRef;

/** Validated, quote-free AI explanation content. */
public record ExplanationContent(
        String summary,
        String context,
        List<KeyPoint> keyPoints,
        List<String> questions,
        List<String> viewpointNotes) {

    public ExplanationContent {
        keyPoints = keyPoints == null ? null : List.copyOf(keyPoints);
        questions = questions == null ? null : List.copyOf(questions);
        viewpointNotes = viewpointNotes == null ? null : List.copyOf(viewpointNotes);
    }

    public record KeyPoint(String text, List<VerseRef> refs) {
        public KeyPoint {
            refs = refs == null ? null : List.copyOf(refs);
        }
    }
}
