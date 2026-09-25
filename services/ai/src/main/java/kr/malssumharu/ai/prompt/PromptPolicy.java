package kr.malssumharu.ai.prompt;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Properties;

/**
 * classpath 의 {@code prompts/versions.properties} 가 가리키는 시스템 정책 파일과 버전 문자열.
 * 정책 텍스트는 고정이다: 입력 본문·언어·범위가 무엇이든 시스템 정책 문자열은 바뀌지 않는다(프롬프트 주입 방어의 구조).
 */
public final class PromptPolicy {

    private final String version;
    private final String systemText;
    private final String sha256;

    public PromptPolicy() {
        Properties p = new Properties();
        try (InputStream in = open("/prompts/versions.properties")) {
            p.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        this.version = p.getProperty("version");
        String file = p.getProperty("file");
        try (InputStream in = open("/prompts/" + file)) {
            byte[] bytes = in.readAllBytes();
            this.systemText = new String(bytes, StandardCharsets.UTF_8);
            this.sha256 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        if (!sha256.equals(p.getProperty("sha256"))) {
            throw new IllegalStateException("prompt policy text changed without bumping version/sha256 in versions.properties");
        }
    }

    private static InputStream open(String path) {
        InputStream in = PromptPolicy.class.getResourceAsStream(path);
        if (in == null) {
            throw new IllegalStateException("missing resource " + path);
        }
        return in;
    }

    public String version() {
        return version;
    }

    public String systemText() {
        return systemText;
    }

    public String sha256() {
        return sha256;
    }
}
