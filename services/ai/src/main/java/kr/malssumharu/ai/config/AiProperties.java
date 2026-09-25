package kr.malssumharu.ai.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * ai.* 설정. 환경 변수 매핑은 application.yml 의 플레이스홀더가 한다.
 *
 * <ul>
 *   <li>{@code ai.generation.enabled}: 기본 false. false 이면 신규 생성을 하지 않고 UNAVAILABLE/AI_DISABLED (환경 변수 AI_GENERATION_ENABLED).
 *       이미 저장된 결과는 계속 제공한다.
 *   <li>{@code ai.generation.monthly-limit}: 월 LLM 호출 횟수 상한(AI_MONTHLY_GENERATION_LIMIT). 기본 0 = 닫힘(한도를 주지 않으면 생성하지 않는다).
 *   <li>{@code ai.budget.monthly-units}: 월 예산 단위 상한(AI_MONTHLY_BUDGET_UNITS). 모델 단가가 미정이라 '단위'로 추상화한다. 기본 0 = 닫힘.
 *   <li>{@code ai.qt.base-url}: QT 서비스 주소(QT_BASE_URL).
 *   <li>{@code ai.storage.table-name}: 미래의 DynamoDB 테이블(AI_TABLE_NAME). 값이 있으면 아직 구현되지 않았으므로 기동을 거부한다.
 * </ul>
 */
@ConfigurationProperties(prefix = "ai")
public record AiProperties(
        @DefaultValue Generation generation,
        @DefaultValue Budget budget,
        @DefaultValue Qt qt,
        @DefaultValue Llm llm,
        @DefaultValue Storage storage,
        @DefaultValue RateLimit rateLimit,
        @DefaultValue Report report,
        @DefaultValue Admin admin,
        @DefaultValue Input input,
        @DefaultValue Cache cache) {

    public record Generation(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("0") long monthlyLimit,
            @DefaultValue("2") int maxAttempts,
            @DefaultValue("30s") Duration callTimeout,
            @DefaultValue("1s") Duration retryDelay,
            @DefaultValue("60s") Duration failureBackoff,
            @DefaultValue("0s") Duration requestWait,
            @DefaultValue("2") int workerThreads,
            @DefaultValue("8") int queueCapacity) {

        /** 작업 하나가 리스를 쥘 수 있는 최대 시간. 이 시간이 지난 GENERATING 은 죽은 작업으로 보고 다른 요청이 넘겨받는다. */
        public Duration leaseTtl() {
            return callTimeout.multipliedBy(maxAttempts).plus(retryDelay.multipliedBy(maxAttempts)).plusSeconds(30);
        }
    }

    public record Budget(
            @DefaultValue("0") long monthlyUnits,
            @DefaultValue("1") long estimatedUnitsPerGeneration) {
    }

    public record Qt(
            @DefaultValue("http://localhost:8081") String baseUrl,
            @DefaultValue("2s") Duration connectTimeout,
            @DefaultValue("5s") Duration requestTimeout) {
    }

    /** 모델·생성 설정·참고 자료의 버전 문자열. 캐시 키에 들어간다. 실제 모델은 사용자가 정한다. */
    public record Llm(
            @DefaultValue("unconfigured") String modelId,
            @DefaultValue("s1") String settingsVersion,
            @DefaultValue("none") String referenceMaterialVersion) {
    }

    public record Storage(@DefaultValue("") String tableName) {
    }

    public record RateLimit(
            @DefaultValue("3") int generationsPerClient,
            @DefaultValue("10") int generationsGlobal,
            @DefaultValue("5") int reportsPerClient,
            @DefaultValue("1m") Duration window,
            @DefaultValue("false") boolean trustForwardedHeader) {
    }

    public record Report(@DefaultValue("3") int severeThreshold) {
    }

    public record Admin(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("") String token) {
    }

    public record Input(@DefaultValue("5") int contextVerses) {
    }

    public record Cache(@DefaultValue("30s") Duration ttl) {
    }
}
