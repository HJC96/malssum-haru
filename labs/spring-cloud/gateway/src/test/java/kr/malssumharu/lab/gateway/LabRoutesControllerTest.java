package kr.malssumharu.lab.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LabRoutesControllerTest {
    private final LabRoutesController controller = new LabRoutesController();

    @Test
    void explanationFallbackDoesNotHideTheSeparateOfficialLinkCatalog() {
        var fallback = controller.explanationFallback();
        var catalog = controller.officialQtLinks();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, fallback.getStatusCode());
        assertEquals("EXPLANATION_UNAVAILABLE", fallback.getBody().get("status"));
        assertEquals("Direct external links, not routed through a downstream content or explanation service.", catalog.get("delivery"));
        @SuppressWarnings("unchecked")
        var links = (java.util.Map<String, String>) catalog.get("links");
        assertTrue(links.get("maeilSeongyeong").startsWith("https://sum.su.or.kr"));
        assertTrue(links.get("saengmyeongUiSam").startsWith("https://www.duranno.com"));
    }
}
