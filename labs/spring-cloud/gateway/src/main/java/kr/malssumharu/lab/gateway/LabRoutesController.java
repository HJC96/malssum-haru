package kr.malssumharu.lab.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class LabRoutesController {
    @GetMapping("/fallback/explanation")
    public ResponseEntity<Map<String, String>> explanationFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "status", "EXPLANATION_UNAVAILABLE",
                "message", "Explanation is optional in this lab; daily content and official QT links remain available."
        ));
    }

    @GetMapping("/api/official-qt-links")
    public Map<String, Object> officialQtLinks() {
        return Map.of(
                "delivery", "Direct external links, not routed through a downstream content or explanation service.",
                "links", Map.of(
                        "maeilSeongyeong", "https://sum.su.or.kr:8888/bible/today",
                        "saengmyeongUiSam", "https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-26"
                )
        );
    }
}
