package kr.malssumharu.ai.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import kr.malssumharu.ai.config.AiProperties;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.explain.ExplanationContent;
import kr.malssumharu.ai.service.AiExplanationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AiExplanationControllerTest {
    private final AiExplanationService service = mock(AiExplanationService.class);
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new AiExplanationController(service, defaultProperties()),
            new AiAdminController(service, defaultProperties())).build();

    @BeforeEach void resetMock() { org.mockito.Mockito.reset(service); }

    @Test void serializesProviderWireValueAndStructuredPassage() throws Exception {
        ExplanationResponse response = new ExplanationResponse("1", "maeil-seongyeong", "2026-09-25", "en",
                ExplanationStatus.UNAVAILABLE, ReasonCode.AI_DISABLED,
                new ExplanationResponse.Passage(List.of(new ExplanationResponse.Range("GEN",
                        new ExplanationResponse.Point(1, 1), new ExplanationResponse.Point(1, 5)))),
                new ExplanationResponse.SourceTranslation("WEB", "World English Bible", "Public Domain", "en"),
                null, null, new ExplanationResponse.ReportPath("/api/ai/reports"));
        when(service.explain(eq(kr.malssumharu.ai.domain.ProviderId.MAEIL_SEONGYEONG),
                eq(kr.malssumharu.ai.domain.Lang.EN), any())).thenReturn(response);

        mvc.perform(get("/api/ai/explanation").param("providerId", "maeil-seongyeong").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.providerId").value("maeil-seongyeong"))
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.passage.ranges[0].start.chapter").value(1))
                .andExpect(jsonPath("$.passage.ranges[0].end.verse").value(5))
                .andExpect(jsonPath("$.sourceTranslation.id").value("WEB"));
        verify(service).explain(eq(kr.malssumharu.ai.domain.ProviderId.MAEIL_SEONGYEONG),
                eq(kr.malssumharu.ai.domain.Lang.EN), any());
    }

    @Test void rejectsUnknownProviderOrLanguage() throws Exception {
        mvc.perform(get("/api/ai/explanation").param("providerId", "other").param("lang", "en"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/ai/explanation").param("providerId", "maeil-seongyeong").param("lang", "fr"))
                .andExpect(status().isBadRequest());
    }

    @Test void validatesReportsAndKeepsAdminDisabledByDefault() throws Exception {
        mvc.perform(post("/api/ai/reports").contentType("application/json")
                        .content("{\"cacheKey\":\"bad\",\"revision\":1,\"category\":\"OTHER\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/internal/ai/admin/hide").contentType("application/json")
                        .content("{\"cacheKey\":\"" + "a".repeat(64) + "\"}"))
                .andExpect(status().isForbidden());
    }

    private static AiProperties defaultProperties() {
        return new AiProperties(new AiProperties.Generation(false, 0, 2, Duration.ofSeconds(30), Duration.ofSeconds(1),
                Duration.ofSeconds(60), Duration.ZERO, 2, 8), new AiProperties.Budget(0, 1),
                new AiProperties.Qt("http://127.0.0.1:8081", Duration.ofSeconds(2), Duration.ofSeconds(5)),
                new AiProperties.Llm("unconfigured", "s1", "none"), new AiProperties.Storage(""),
                new AiProperties.RateLimit(3, 10, 5, Duration.ofMinutes(1), false), new AiProperties.Report(3),
                new AiProperties.Admin(false, ""), new AiProperties.Input(5), new AiProperties.Cache(Duration.ofSeconds(30)));
    }
}
