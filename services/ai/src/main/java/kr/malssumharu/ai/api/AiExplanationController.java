package kr.malssumharu.ai.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import kr.malssumharu.ai.config.AiProperties;
import kr.malssumharu.ai.domain.Lang;
import kr.malssumharu.ai.domain.ProviderId;
import kr.malssumharu.ai.service.AiExplanationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/ai")
public class AiExplanationController {
    private final AiExplanationService service;
    private final AiProperties props;

    public AiExplanationController(AiExplanationService service, AiProperties props) {
        this.service = service;
        this.props = props;
    }

    @GetMapping("/explanation")
    public ResponseEntity<?> explanation(@RequestParam String providerId, @RequestParam String lang, HttpServletRequest request) {
        ProviderId provider = ProviderId.fromWire(providerId).orElse(null);
        Lang outputLanguage = Lang.fromWire(lang).orElse(null);
        if (provider == null || outputLanguage == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(service.explain(provider, outputLanguage, clientIdentity(request)));
    }

    @PostMapping("/reports")
    public ResponseEntity<?> report(@RequestBody(required = false) ReportRequest body, HttpServletRequest request) {
        if (body == null || body.cacheKey() == null || !body.cacheKey().matches("[a-f0-9]{64}")
                || body.revision() < 1 || body.category() == null
                || !java.util.List.of("FACTUAL_ERROR", "WRONG_REFERENCE", "OFFENSIVE", "OTHER").contains(body.category())
                || body.note() != null && body.note().length() > 200) return ResponseEntity.badRequest().build();
        AiExplanationService.ReportResult result = service.report(body.cacheKey(), body.revision(), body.category(), body.note(), clientIdentity(request));
        if (result.httpStatus() == 400) return ResponseEntity.badRequest().build();
        if (result.httpStatus() == 429) return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(new ErrorResponse("RATE_LIMITED"));
        if (result.httpStatus() == 409) return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("REVISION_UNAVAILABLE"));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ReportResponse(true,
                result.status() == null ? null : result.status().name()));
    }

    private String clientIdentity(HttpServletRequest request) {
        String identity = request.getRemoteAddr();
        if (props.rateLimit().trustForwardedHeader()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) identity = forwarded.split(",", 2)[0].trim();
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(String.valueOf(identity).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public record ReportRequest(String cacheKey, int revision, String category, String note) { }
    public record ReportResponse(boolean accepted, String status) { }
    public record ErrorResponse(String code) { }
}
