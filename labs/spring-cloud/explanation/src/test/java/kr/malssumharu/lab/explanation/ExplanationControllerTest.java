package kr.malssumharu.lab.explanation;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ExplanationControllerTest {
    private final ExplanationController controller = new ExplanationController();

    @Test
    void deliberatelyFailsWithoutCallingAnExternalModel() {
        var response = controller.explanation(true);
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("MOCK_EXPLANATION_FAILURE", response.getBody().get("status"));
    }

    @Test
    void healthyModeExplicitlyIdentifiesItselfAsMockOnly() {
        var response = controller.explanation(false);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("MOCK_EXPLANATION_ONLY", response.getBody().get("status"));
    }
}
