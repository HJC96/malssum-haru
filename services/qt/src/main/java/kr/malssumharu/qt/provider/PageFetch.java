package kr.malssumharu.qt.provider;

import java.net.URI;
import java.util.Optional;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.http.FetchException;
import kr.malssumharu.qt.http.FetchResponse;
import kr.malssumharu.qt.http.HttpFetcher;

/** 공식 페이지 GET 한 번으로 링크 확인과 장절 취득을 겸한다. 실패 매핑을 두 어댑터가 공유한다. */
final class PageFetch {

    private PageFetch() {
    }

    record Result(FetchResponse response, AdapterOutcome.Failed failure) {
        boolean ok() {
            return failure == null;
        }
    }

    static Result get(HttpFetcher fetcher, URI uri) {
        try {
            FetchResponse response = fetcher.get(uri);
            if (!response.isSuccess()) {
                return new Result(null, AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_HTTP_ERROR));
            }
            return new Result(response, null);
        } catch (FetchException e) {
            return new Result(null, AdapterOutcome.Failed.linkError(linkReason(e.kind())));
        }
    }

    static ReasonCode linkReason(FetchException.Kind kind) {
        return switch (kind) {
            case TIMEOUT -> ReasonCode.UPSTREAM_TIMEOUT;
            case UNREACHABLE -> ReasonCode.LINK_UNREACHABLE;
            case TOO_LARGE -> ReasonCode.UPSTREAM_HTTP_ERROR;
        };
    }

    static Optional<String> firstGroup(java.util.regex.Matcher m) {
        return m.find() ? Optional.of(m.group(1)) : Optional.empty();
    }
}
