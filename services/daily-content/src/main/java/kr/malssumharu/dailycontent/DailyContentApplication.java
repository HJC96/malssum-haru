package kr.malssumharu.dailycontent;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.function.Function;
import kr.malssumharu.dailycontent.catalog.CandidateCatalog;
import kr.malssumharu.dailycontent.catalog.CatalogLoader;
import kr.malssumharu.dailycontent.publish.DailyContentPublisher;
import kr.malssumharu.dailycontent.publish.PublishRequest;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class DailyContentApplication {
    public static void main(String[] args) {
        if (java.util.Arrays.stream(args).anyMatch(arg -> arg.startsWith("--date=") || "--help".equals(arg))) {
            kr.malssumharu.dailycontent.cli.DailyContentCli.run(args);
            return;
        }
        SpringApplication.run(DailyContentApplication.class, args);
    }

    @Bean
    @Primary
    ObjectMapper dailyContentObjectMapper() {
        return new ObjectMapper().findAndRegisterModules();
    }

    @Bean
    CandidateCatalog candidateCatalog(ObjectMapper objectMapper) {
        return new CatalogLoader(objectMapper).loadClasspath("/catalog/candidate-catalog-v1.json");
    }

    @Bean
    DailyContentPublisher dailyContentPublisher(CandidateCatalog catalog, ObjectMapper objectMapper) {
        return new DailyContentPublisher(catalog, objectMapper);
    }

    /** Spring Cloud Function entry point. The AWS runtime adapter is intentionally an infrastructure concern. */
    @Bean
    Function<PublishRequest, String> publishDailyWord(DailyContentPublisher publisher) {
        return request -> publisher.render(request).json();
    }
}
