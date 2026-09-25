package kr.malssumharu.ai.api;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import kr.malssumharu.ai.config.AiProperties;
import kr.malssumharu.ai.domain.Lang;
import kr.malssumharu.ai.domain.ProviderId;
import kr.malssumharu.ai.explain.ExplanationContent;
import kr.malssumharu.ai.service.AiExplanationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

/** Development-only local operator API. It is disabled unless explicitly configured. */
@RestController
@RequestMapping("/internal/ai/admin")
public class AiAdminController {
    private final AiExplanationService service;
    private final AiProperties props;

    public AiAdminController(AiExplanationService service, AiProperties props) {
        this.service = service;
        this.props = props;
    }

    @PostMapping("/hide")
    public ResponseEntity<?> hide(@RequestBody(required = false) KeyRequest body,
            @RequestHeader(value = "X-Admin-Token", required = false) String token, HttpServletRequest request) {
        ResponseEntity<?> denied = authorize(token, request);
        if (denied != null) return denied;
        if (body == null) return ResponseEntity.badRequest().build();
        boolean changed = service.hide(body.cacheKey());
        return changed ? ResponseEntity.ok(Map.of("updated", true)) : ResponseEntity.notFound().build();
    }

    @PostMapping("/invalidate")
    public ResponseEntity<?> invalidate(@RequestBody(required = false) KeyRequest body,
            @RequestHeader(value = "X-Admin-Token", required = false) String token, HttpServletRequest request) {
        ResponseEntity<?> denied = authorize(token, request);
        if (denied != null) return denied;
        if (body == null) return ResponseEntity.badRequest().build();
        boolean changed = service.invalidate(body.cacheKey());
        return changed ? ResponseEntity.ok(Map.of("updated", true)) : ResponseEntity.notFound().build();
    }

    @PostMapping("/replace-revision")
    public ResponseEntity<?> replace(@RequestBody(required = false) ReplaceRequest body,
            @RequestHeader(value = "X-Admin-Token", required = false) String token, HttpServletRequest request) {
        ResponseEntity<?> denied = authorize(token, request);
        if (denied != null) return denied;
        if (body == null || body.content() == null) return ResponseEntity.badRequest().build();
        ProviderId provider = ProviderId.fromWire(body.providerId()).orElse(null);
        Lang lang = Lang.fromWire(body.lang()).orElse(null);
        if (provider == null || lang == null) return ResponseEntity.badRequest().build();
        boolean changed = service.replace(provider, lang, body.cacheKey(), body.expectedRevision(), body.content());
        return changed ? ResponseEntity.ok(Map.of("updated", true)) : ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("updated", false));
    }

    @PostMapping("/regenerate")
    public ResponseEntity<?> regenerate(@RequestBody(required = false) RegenerateRequest body,
            @RequestHeader(value = "X-Admin-Token", required = false) String token, HttpServletRequest request) {
        ResponseEntity<?> denied = authorize(token, request);
        if (denied != null) return denied;
        if (body == null) return ResponseEntity.badRequest().build();
        ProviderId provider = ProviderId.fromWire(body.providerId()).orElse(null);
        Lang lang = Lang.fromWire(body.lang()).orElse(null);
        if (provider == null || lang == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(service.regenerate(provider, lang, body.cacheKey(), "admin"));
    }

    private ResponseEntity<?> authorize(String token, HttpServletRequest request) {
        String expected = props.admin().token();
        if (!props.admin().enabled() || expected == null || expected.isBlank() || token == null || !isLoopback(request.getRemoteAddr())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("code", "ADMIN_DISABLED"));
        }
        boolean matches = MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8));
        return matches ? null : ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("code", "ADMIN_DISABLED"));
    }

    private static boolean isLoopback(String address) {
        try { return address != null && InetAddress.getByName(address).isLoopbackAddress(); }
        catch (Exception invalid) { return false; }
    }

    public record KeyRequest(String cacheKey) { }
    public record ReplaceRequest(String providerId, String lang, String cacheKey, int expectedRevision,
                                 ExplanationContent content) { }
    public record RegenerateRequest(String providerId, String lang, String cacheKey) { }
}
