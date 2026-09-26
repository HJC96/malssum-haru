package kr.malssumharu.lab.content;

import org.junit.jupiter.api.Test;
class DailyContentControllerTest {
    @Test
    void servesOnlyAnExplicitNonScriptureFixture() throws Exception {
        String fixture = new DailyContentController().dailyContent();
        org.junit.jupiter.api.Assertions.assertTrue(fixture.contains("NO_SCRIPTURE_CONTENT"));
        org.junit.jupiter.api.Assertions.assertTrue(fixture.contains("No Bible text or explanation is bundled"));
    }
}
