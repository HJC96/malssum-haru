package kr.malssumharu.ai.config;

import java.time.Clock;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import kr.malssumharu.ai.bible.AlignmentPolicy;
import kr.malssumharu.ai.bible.InputAssembler;
import kr.malssumharu.ai.bible.WebBible;
import kr.malssumharu.ai.budget.MonthlyBudget;
import kr.malssumharu.ai.explain.OutputValidator;
import kr.malssumharu.ai.llm.LlmClient;
import kr.malssumharu.ai.llm.UnconfiguredLlmClient;
import kr.malssumharu.ai.prompt.PromptBuilder;
import kr.malssumharu.ai.prompt.PromptPolicy;
import kr.malssumharu.ai.qt.HttpQtRangeClient;
import kr.malssumharu.ai.qt.QtRangeClient;
import kr.malssumharu.ai.ratelimit.WindowRateLimiter;
import kr.malssumharu.ai.store.ExplanationStore;
import kr.malssumharu.ai.store.InMemoryExplanationStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfiguration {
    @Bean Clock aiClock() { return Clock.systemUTC(); }
    @Bean WebBible webBible() { return new WebBible(); }
    @Bean AlignmentPolicy alignmentPolicy(WebBible web) { return new AlignmentPolicy(web); }
    @Bean InputAssembler inputAssembler(WebBible web, AlignmentPolicy alignment, AiProperties props) {
        return new InputAssembler(web, alignment, props.input().contextVerses());
    }
    @Bean OutputValidator outputValidator() { return new OutputValidator(); }
    @Bean PromptPolicy promptPolicy() { return new PromptPolicy(); }
    @Bean PromptBuilder promptBuilder(PromptPolicy policy) { return new PromptBuilder(policy); }
    @Bean @ConditionalOnMissingBean(LlmClient.class) LlmClient llmClient() { return new UnconfiguredLlmClient(); }
    @Bean @ConditionalOnMissingBean(QtRangeClient.class)
    QtRangeClient qtRangeClient(AiProperties props) {
        return new HttpQtRangeClient(props.qt().baseUrl(), props.qt().connectTimeout(), props.qt().requestTimeout());
    }
    @Bean ExplanationStore explanationStore(AiProperties props) {
        if (props.storage().tableName() != null && !props.storage().tableName().isBlank()) {
            throw new IllegalStateException("AI_TABLE_NAME is configured, but persistent AI storage is not implemented");
        }
        return new InMemoryExplanationStore();
    }
    @Bean MonthlyBudget monthlyBudget(AiProperties props) {
        return new MonthlyBudget(props.generation().monthlyLimit(), props.budget().monthlyUnits());
    }
    @Bean(name = "aiClientLimiter") WindowRateLimiter clientLimiter(AiProperties props) {
        return new WindowRateLimiter(props.rateLimit().generationsPerClient(), props.rateLimit().window());
    }
    @Bean(name = "aiGlobalLimiter") WindowRateLimiter globalLimiter(AiProperties props) {
        return new WindowRateLimiter(props.rateLimit().generationsGlobal(), props.rateLimit().window());
    }
    @Bean(name = "aiReportLimiter") WindowRateLimiter reportLimiter(AiProperties props) {
        return new WindowRateLimiter(props.rateLimit().reportsPerClient(), props.rateLimit().window());
    }
    @Bean(name = "aiGenerationExecutor", destroyMethod = "shutdown") ExecutorService generationExecutor(AiProperties props) {
        return executor("ai-generation", props.generation().workerThreads(), props.generation().queueCapacity());
    }
    @Bean(name = "aiLlmExecutor", destroyMethod = "shutdown") ExecutorService llmExecutor(AiProperties props) {
        return executor("ai-llm", props.generation().workerThreads(), props.generation().queueCapacity());
    }
    private static ExecutorService executor(String name, int requestedThreads, int requestedCapacity) {
        int threads = Math.max(1, requestedThreads);
        int capacity = Math.max(1, requestedCapacity);
        return new ThreadPoolExecutor(threads, threads, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(capacity), r -> {
                    Thread thread = new Thread(r, name);
                    thread.setDaemon(true);
                    return thread;
                }, new ThreadPoolExecutor.AbortPolicy());
    }
}
