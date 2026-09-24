package kr.malssumharu.qt.http;

public class FetchException extends Exception {

    public enum Kind {
        TIMEOUT,
        UNREACHABLE,
        TOO_LARGE
    }

    private final Kind kind;

    public FetchException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }
}
