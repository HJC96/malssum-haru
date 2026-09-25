package kr.malssumharu.ai.config;

import static org.assertj.core.api.Assertions.assertThat;

import kr.malssumharu.ai.service.AiExplanationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AiApplicationContextTest {
    @Autowired AiProperties properties;
    @Autowired AiExplanationService service;

    @Test void startsWithGenerationAndBudgetFailClosed() {
        assertThat(service).isNotNull();
        assertThat(properties.generation().enabled()).isFalse();
        assertThat(properties.generation().monthlyLimit()).isZero();
        assertThat(properties.budget().monthlyUnits()).isZero();
        assertThat(properties.storage().tableName()).isEmpty();
    }
}
