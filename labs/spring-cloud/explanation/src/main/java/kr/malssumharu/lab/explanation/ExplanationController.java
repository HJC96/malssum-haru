package kr.malssumharu.lab.explanation;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ExplanationController {
    @GetMapping("/api/explanations")
    public ResponseEntity<Map<String, String>> explanation(@RequestParam(defaultValue = "false") boolean fail) {
        if (fail) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "MOCK_EXPLANATION_FAILURE",
                    "message", "A deliberate local failure used to demonstrate the Gateway circuit breaker."
            ));
        }
        return ResponseEntity.ok(Map.of(
                "status", "MOCK_EXPLANATION_ONLY",
                "message", "No LLM is called and no Scripture text or explanation content is included in this lab."
        ));
    }
}
