package kr.malssumharu.ai.explain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Set;
import kr.malssumharu.ai.bible.GenerationInput;
import kr.malssumharu.ai.bible.GenerationInput.InputVerse;
import kr.malssumharu.ai.bible.GenerationInput.Role;
import kr.malssumharu.ai.domain.RangeSet;
import kr.malssumharu.ai.domain.VerseRange;
import kr.malssumharu.ai.domain.VerseRef;
import org.junit.jupiter.api.Test;

class OutputValidatorTest {
    private final OutputValidator validator = new OutputValidator();
    private final VerseRef ref = new VerseRef("GEN", 1, 1);
    private final GenerationInput input = new GenerationInput(new RangeSet(List.of(new VerseRange("GEN", 1, 1, 1, 1))),
            List.of(new InputVerse(ref, Role.PASSAGE, "A source line with eight distinct words kept for quote checking today.")),
            Set.of(ref), "hash");

    @Test void acceptsSchemaWithOnlyReferencesAndAllowedVerses() {
        String raw = """
                {"summary":"The passage introduces a beginning and an act of creation.",
                 "context":"No neighbouring verse was included in this short test.",
                 "keyPoints":[{"text":"The opening frames the account.","refs":[{"bookId":"GEN","chapter":1,"verse":1}]}],
                 "questions":["What does the opening emphasize?"],"viewpointNotes":[]}
                """;
        assertThat(validator.validate(raw, input).keyPoints()).hasSize(1);
    }

    @Test void rejectsReferencesOutsideSuppliedPassageAndContext() {
        ExplanationContent invalid = new ExplanationContent("Summary", "Context",
                List.of(new ExplanationContent.KeyPoint("Point", List.of(new VerseRef("GEN", 1, 2)))),
                List.of("Question?"), List.of());
        assertThatThrownBy(() -> validator.validateContent(invalid, input))
                .isInstanceOf(OutputValidator.InvalidOutputException.class);
    }

    @Test void rejectsEightConsecutiveSourceWords() {
        String raw = """
                {"summary":"A source line with eight distinct words kept for quote checking today.",
                 "context":"Some neutral context.",
                 "keyPoints":[{"text":"An explanation.","refs":[{"bookId":"GEN","chapter":1,"verse":1}]}],
                 "questions":["What does this suggest?"],"viewpointNotes":[]}
                """;
        assertThatThrownBy(() -> validator.validate(raw, input))
                .isInstanceOf(OutputValidator.InvalidOutputException.class);
    }

    @Test void rejectsMarkupInAnyTextField() {
        ExplanationContent invalid = new ExplanationContent("<script>alert(1)</script>", "Context",
                List.of(new ExplanationContent.KeyPoint("Point", List.of(ref))),
                List.of("Question?"), List.of());
        assertThatThrownBy(() -> validator.validateContent(invalid, input))
                .isInstanceOf(OutputValidator.InvalidOutputException.class);
    }

    @Test void rejectsMalformedAndMissingRequiredFields() {
        assertThatThrownBy(() -> validator.validate("not json", input))
                .isInstanceOf(OutputValidator.InvalidOutputException.class);
        assertThatThrownBy(() -> validator.validate("{}", input))
                .isInstanceOf(OutputValidator.InvalidOutputException.class);
    }
}
