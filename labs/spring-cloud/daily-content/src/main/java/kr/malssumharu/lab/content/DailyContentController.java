package kr.malssumharu.lab.content;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
public class DailyContentController {
    private final String fixture;

    public DailyContentController() throws IOException {
        this.fixture = new ClassPathResource("daily-content.json").getContentAsString(StandardCharsets.UTF_8);
    }

    @GetMapping(value = "/api/daily-content", produces = MediaType.APPLICATION_JSON_VALUE)
    public String dailyContent() {
        return fixture;
    }
}
