package kr.malssumharu.ai.explain;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kr.malssumharu.ai.bible.GenerationInput;
import kr.malssumharu.ai.domain.VerseRef;
import tools.jackson.databind.json.JsonMapper;

/** Strict parser for model output; raw output is never returned or logged. */
public final class OutputValidator {
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}']+");
    private static final Pattern MARKUP = Pattern.compile("(?is)<\\s*/?\\s*[a-z][^>]*>|!?\\[[^\\]]+\\]\\([^)]+\\)|```|^\\s{0,3}#{1,6}\\s", Pattern.MULTILINE);
    private static final int FORBIDDEN_QUOTE_WORDS = 8;
    private static final JsonMapper JSON = JsonMapper.builder().build();

    public ExplanationContent validate(String raw, GenerationInput input) {
        if (raw == null || raw.length() > 40_000) {
            throw new InvalidOutputException();
        }
        final ExplanationContent content;
        try {
            content = JSON.readValue(raw, ExplanationContent.class);
        } catch (Exception e) {
            throw new InvalidOutputException();
        }
        validateContent(content, input);
        return content;
    }

    public void validateContent(ExplanationContent content, GenerationInput input) {
        if (content == null || blank(content.summary()) || blank(content.context())
                || content.keyPoints() == null || content.keyPoints().isEmpty() || content.keyPoints().size() > 8
                || content.questions() == null || content.questions().isEmpty() || content.questions().size() > 5
                || content.viewpointNotes() == null) {
            throw new InvalidOutputException();
        }
        for (ExplanationContent.KeyPoint point : content.keyPoints()) {
            if (point == null || blank(point.text()) || point.refs() == null || point.refs().isEmpty()) {
                throw new InvalidOutputException();
            }
            for (VerseRef ref : point.refs()) {
                if (ref == null || !input.allowedRefs().contains(ref)) {
                    throw new InvalidOutputException();
                }
            }
        }
        if (content.questions().stream().anyMatch(OutputValidator::blank)
                || content.viewpointNotes().stream().anyMatch(OutputValidator::blank)) {
            throw new InvalidOutputException();
        }
        List<String> outputTexts = new ArrayList<>();
        outputTexts.add(content.summary());
        outputTexts.add(content.context());
        content.keyPoints().forEach(p -> outputTexts.add(p.text()));
        outputTexts.addAll(content.questions());
        outputTexts.addAll(content.viewpointNotes());
        Set<String> sourceNgrams = sourceNgrams(input);
        for (String output : outputTexts) {
            if (MARKUP.matcher(output).find() || containsSourceQuote(output, sourceNgrams)) {
                throw new InvalidOutputException();
            }
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static Set<String> sourceNgrams(GenerationInput input) {
        Set<String> grams = new HashSet<>();
        List<String> adjacentWords = new ArrayList<>();
        VerseRef previous = null;
        for (GenerationInput.InputVerse verse : input.verses()) {
            List<String> words = words(verse.text());
            addNgrams(grams, words);
            if (previous != null && !adjacent(previous, verse.ref())) {
                addNgrams(grams, adjacentWords);
                adjacentWords.clear();
            }
            adjacentWords.addAll(words);
            previous = verse.ref();
        }
        addNgrams(grams, adjacentWords);
        return grams;
    }

    private static boolean adjacent(VerseRef previous, VerseRef next) {
        if (!previous.bookId().equals(next.bookId())) return false;
        return previous.chapter() == next.chapter() && next.verse() == previous.verse() + 1
                || next.chapter() == previous.chapter() + 1 && next.verse() == 1;
    }

    private static void addNgrams(Set<String> grams, List<String> words) {
        for (int i = 0; i + FORBIDDEN_QUOTE_WORDS <= words.size(); i++) {
            grams.add(String.join(" ", words.subList(i, i + FORBIDDEN_QUOTE_WORDS)));
        }
    }

    private static boolean containsSourceQuote(String text, Set<String> sourceNgrams) {
        List<String> words = words(text);
        for (int i = 0; i + FORBIDDEN_QUOTE_WORDS <= words.size(); i++) {
            if (sourceNgrams.contains(String.join(" ", words.subList(i, i + FORBIDDEN_QUOTE_WORDS)))) {
                return true;
            }
        }
        return false;
    }

    private static List<String> words(String value) {
        Matcher matcher = WORD.matcher(value.toLowerCase(Locale.ROOT));
        List<String> out = new ArrayList<>();
        while (matcher.find()) out.add(matcher.group());
        return out;
    }

    public static final class InvalidOutputException extends RuntimeException { }
}
