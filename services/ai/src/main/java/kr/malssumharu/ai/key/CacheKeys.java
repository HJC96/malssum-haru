package kr.malssumharu.ai.key;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * 캐시 키 = SHA-256(정규 직렬화). 각 값을 {@code 이름=길이:값} 으로 이어 붙여 값 경계가 모호해지지 않게 하고(결정적),
 * 재료 하나만 달라도 키가 달라진다. 키 스키마를 바꾸면 SCHEMA 를 올린다.
 */
public final class CacheKeys {

    static final String SCHEMA = "ai-key-1";

    private CacheKeys() {
    }

    public static String compute(CacheKeyParts p) {
        StringBuilder sb = new StringBuilder();
        field(sb, "schema", SCHEMA);
        field(sb, "ranges", p.rangesCanonical());
        field(sb, "translation", p.translationId());
        field(sb, "versification", p.versificationBasis());
        field(sb, "inputDataVersion", p.inputDataVersion());
        field(sb, "inputHash", p.inputHash());
        field(sb, "lang", p.lang().wire());
        field(sb, "options", p.options());
        field(sb, "promptVersion", p.promptVersion());
        field(sb, "model", p.modelId());
        field(sb, "modelSettings", p.modelSettingsVersion());
        field(sb, "reference", p.referenceVersion());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void field(StringBuilder sb, String name, String value) {
        sb.append(name).append('=').append(value.length()).append(':').append(value).append('\n');
    }

    /** 로그용 짧은 표기(키 자체가 해시라 개인 정보가 없다). */
    public static String shortId(String key) {
        return key.length() <= 12 ? key : key.substring(0, 12);
    }
}
