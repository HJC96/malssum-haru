#!/usr/bin/env python3
"""eBible.org 의 World English Bible(engwebp, USFM) zip 을 정확히 한 번 내려받는다.

- 출처: https://ebible.org/Scriptures/engwebp_usfm.zip  (WEB, 퍼블릭 도메인. docs/data-sources.md 11절)
- 원본 zip 은 저장소에 넣지 않는다. 기본 저장 위치는 저장소 밖(--out)이며, 이미 파일이 있으면 다시 내려받지 않는다.
- 접근이 차단되면(403 등) 우회하지 않고 종료 코드 2로 멈춘다. 개인정보(이메일 등)는 요청에 넣지 않는다.
- 기록: 내려받은 날짜, 바이트 크기, SHA-256, HTTP 응답 헤더 일부를 provenance JSON 으로 출력한다.

사용: python3 fetch_web.py --out /path/outside/repo/engwebp_usfm.zip --provenance /path/to/provenance.json
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import sys
import urllib.error
import urllib.request

URL = "https://ebible.org/Scriptures/engwebp_usfm.zip"
USER_AGENT = "malssum-haru-ai-tools/0.1 (non-commercial prototype; one-time download)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="zip 저장 경로(저장소 밖 권장)")
    ap.add_argument("--provenance", required=True, help="출처 기록 JSON 출력 경로")
    args = ap.parse_args()

    out = pathlib.Path(args.out)
    prov_path = pathlib.Path(args.provenance)
    if out.exists() or prov_path.exists():
        print(f"이미 내려받았습니다({out if out.exists() else prov_path}). 다시 내려받지 않습니다.", file=sys.stderr)
        return 1

    req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            status = resp.status
            headers = {k: v for k, v in resp.headers.items() if k.lower() in ("content-length", "last-modified", "content-type", "etag")}
            data = resp.read()
    except urllib.error.HTTPError as e:
        print(f"접근 거절 또는 오류(HTTP {e.code}). 우회하지 않고 중단합니다.", file=sys.stderr)
        return 2
    except urllib.error.URLError as e:
        print(f"연결 실패({e.reason}). 중단합니다.", file=sys.stderr)
        return 2

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    prov = {
        "sourceUrl": URL,
        "downloadedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "httpStatus": status,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "responseHeaders": headers,
    }
    prov_path.parent.mkdir(parents=True, exist_ok=True)
    prov_path.write_text(json.dumps(prov, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(prov, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
