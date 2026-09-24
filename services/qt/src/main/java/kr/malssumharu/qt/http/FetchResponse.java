package kr.malssumharu.qt.http;

import java.nio.charset.Charset;
import java.nio.charset.IllegalCharsetNameException;
import java.nio.charset.UnsupportedCharsetException;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 본문 바이트는 어댑터가 파싱한 뒤 버린다. 로그·저장에 쓰지 않는다. */
public record FetchResponse(int status, byte[] body, String contentType) {

    private static final Pattern CHARSET = Pattern.compile("charset=\\s*\"?([\\w.:-]+)", Pattern.CASE_INSENSITIVE);

    public boolean isSuccess() {
        return status >= 200 && status < 300;
    }

    /** Content-Type 헤더에 선언된 문자셋. 없거나 모르는 이름이면 empty. */
    public Optional<Charset> declaredCharset() {
        if (contentType == null) {
            return Optional.empty();
        }
        Matcher m = CHARSET.matcher(contentType);
        String name = null;
        while (m.find()) {
            name = m.group(1);
        }
        if (name == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(Charset.forName(name));
        } catch (IllegalCharsetNameException | UnsupportedCharsetException e) {
            return Optional.empty();
        }
    }
}
