package kr.malssumharu.qt.http;

import java.net.URI;

/** 제공처 접근용 HTTP 경계. 테스트에서는 로컬 목 서버를 가리키는 구현을 쓴다. */
public interface HttpFetcher {

    FetchResponse get(URI uri) throws FetchException;

    FetchResponse postJson(URI uri, String jsonBody) throws FetchException;
}
