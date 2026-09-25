#!/usr/bin/env python3
"""WEB 절 데이터와 우리 잠정 구조 표(web/src/data/nkrvProvisional.ts, 읽기 전용)를 전 장에 대해 비교한다.

산출물:
  - src/main/resources/bible/alignment.json  (서비스가 쓰는 '구조가 다른 장' 목록. AlignmentPolicy)
  - docs/verse-alignment.md                   (사람이 읽는 보고서)
표를 다시 만들면(planner-core 가 재생성하면) 이 스크립트를 다시 돌리고, Java 테스트(VerseAlignmentTest)가 두 산출물이
표·WEB 과 여전히 일치하는지 검사한다.

사용: python3 tools/alignment_report.py   (services/ai 에서 실행)
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TABLE = ROOT.parent.parent / "web" / "src" / "data" / "nkrvProvisional.ts"
WEBDIR = ROOT / "src" / "main" / "resources" / "bible" / "web"
OUT_JSON = ROOT / "src" / "main" / "resources" / "bible" / "alignment.json"
OUT_MD = ROOT / "docs" / "verse-alignment.md"


def load_table():
    ts = TABLE.read_text(encoding="utf-8")
    table = {}
    order = []
    for m in re.finditer(r"bookId: '(\w+)'.*?chapterVerseCounts: \[([\d, ]+)\]", ts):
        table[m.group(1)] = [int(x) for x in m.group(2).split(",")]
        order.append(m.group(1))
    canon = re.search(r"NKRV_PROVISIONAL_CANONICAL_SHA256 = '([0-9a-f]+)'", ts).group(1)
    system = re.search(r"versificationSystem: '([^']+)'", ts).group(1)
    version = re.search(r"dataVersion: '([^']+)'", ts).group(1)
    return table, order, canon, system, version


def load_web(books):
    web = {}
    titles = {}
    for b in books:
        doc = json.loads((WEBDIR / f"{b}.json").read_text(encoding="utf-8"))
        for c in doc["chapters"]:
            web[(b, c["chapter"])] = {int(v): t for v, t in c["verses"].items()}
            if "title" in c:
                titles[(b, c["chapter"])] = c["title"]
    return web, titles


def main():
    table, order, canon, system, version = load_table()
    web, titles = load_web(order)
    manifest = json.loads((WEBDIR / "manifest.json").read_text(encoding="utf-8"))

    empty, absent, extra, differing = [], [], [], []
    chapters = 0
    web_only_chapters = [k for k in web if k[1] > len(table[k[0]])]
    for b in order:
        for ch, n in enumerate(table[b], 1):
            chapters += 1
            w = web.get((b, ch))
            if w is None:
                differing.append({"bookId": b, "chapter": ch, "tableVerses": n, "webVerseMarkers": 0, "webNonEmptyVerses": 0, "webMaxVerse": 0})
                absent += [(b, ch, v) for v in range(1, n + 1)]
                continue
            nonempty = {v for v, t in w.items() if t}
            for v in range(1, n + 1):
                if v not in w:
                    absent.append((b, ch, v))
                elif not w[v]:
                    empty.append((b, ch, v))
            for v in sorted(nonempty):
                if v > n:
                    extra.append((b, ch, v))
            if set(w) != set(range(1, n + 1)) or len(nonempty) != n:
                differing.append({"bookId": b, "chapter": ch, "tableVerses": n, "webVerseMarkers": len(w),
                                  "webNonEmptyVerses": len(nonempty), "webMaxVerse": max(w)})

    total_web_markers = sum(len(v) for v in web.values())
    total_web_nonempty = sum(1 for v in web.values() for t in v.values() if t)
    total_table = sum(sum(v) for v in table.values())

    alignment = {
        "generatedBy": "tools/alignment_report.py",
        "structureTable": {"id": system, "dataVersion": version, "canonicalSha256": canon,
                           "source": "web/src/data/nkrvProvisional.ts (planner-core, read-only)"},
        "webDataSha256": manifest["dataSha256"],
        "comparedChapters": chapters,
        "differingChapters": differing,
        "emptyVerseMarkers": [{"bookId": b, "chapter": c, "verse": v} for (b, c, v) in empty],
        "absentInWeb": [{"bookId": b, "chapter": c, "verse": v} for (b, c, v) in absent if (b, c, v) not in set(empty)],
        "webOnlyVerses": [{"bookId": b, "chapter": c, "verse": v} for (b, c, v) in extra],
    }
    OUT_JSON.write_text(json.dumps(alignment, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def row(d):
        return f"| {d['bookId']} {d['chapter']} | {d['tableVerses']} | {d['webVerseMarkers']} | {d['webNonEmptyVerses']} | {d['webMaxVerse']} |"

    def refs(items):
        return ", ".join(f"{b} {c}:{v}" for (b, c, v) in items) or "없음"

    absent_only = [(b, c, v) for (b, c, v) in absent if (b, c, v) not in set(empty)]
    psalm_titles = sorted(c for (b, c) in titles if b == "PSA")
    md = f"""# WEB 대 우리 잠정 절 구조 표: 절 번호 대응 보고서

- 작성: ai-content(`tools/alignment_report.py`가 생성한 표를 바탕으로 정리), 2026-09-24. 관련: 계약 `docs/contracts/ai-explain.md` 원칙 2, `docs/data-sources.md` 11-3·11-4, T18.
- 비교 대상 A: WEB(`engwebp`, {manifest['source']['sourceUrl']}, 내려받은 날 {manifest['source']['downloadedAt']}, SHA-256 `{manifest['source']['sha256']}`)에서 만든 절 데이터, 데이터 해시 `{manifest['dataSha256']}`.
- 비교 대상 B: `web/src/data/nkrvProvisional.ts`의 `chapterVerseCounts`(체계 `{system}`, 데이터 `{version}`, 정규 해시 `{canon}`). planner-core 소유, 읽기만 했다. **개역개정 전수 검증본이 아닌 잠정 표**이므로 아래 결과는 'WEB 대 잠정 표'의 관찰이다. 개역개정 자체와의 일치는 확인하지 못했다.
- 재현: `cd services/ai && python3 tools/alignment_report.py`. Java 쪽 `VerseAlignmentTest`가 같은 결과를 독립적으로(표를 파싱하는 테스트 유틸 `NkrvProvisionalTable`) 다시 계산해 `alignment.json`과 비교한다. 표나 WEB 데이터가 바뀌면 그 테스트가 실패한다.

## 요약

| 항목 | 값 |
| --- | --- |
| 비교한 장 수 | {chapters} (66권) |
| 표의 절 합계 | {total_table} |
| WEB 절 마커 합계 | {total_web_markers} (본문이 있는 절 {total_web_nonempty}) |
| WEB에만 있는 장 | {len(web_only_chapters)} |
| 절 구조가 다른 장 | **{len(differing)}개** (아래 표) |
| 절 집합이 완전히 같은 장 | {chapters - len(differing)} |

마커 합계가 표의 합계(31,103)와 같은 것은 우연의 일치에 가깝다. 표에는 있고 WEB에는 없는 절과 WEB에만 있는 절이 같은 개수(3개 대 3개)로 상쇄된다.

## 1. WEB에 본문이 없는 절 (표에는 있음)

WEB이 절 번호 마커는 두되 본문을 비워 둔 절({len(empty)}개. 본문을 비운 이유는 확인하지 않았다): **{refs(empty)}**.

WEB에 절 번호 마커 자체가 없는 절({len(absent_only)}개): **{refs(absent_only)}**.

## 2. WEB에만 있는 절 (표에는 없음)

{len(extra)}개: **{refs(extra)}**. WEB은 로마서의 송영을 14장 끝(14:24-26)에 두고, 우리 표는 16장 끝(16:25-27)에 둔다. 14장 표는 23절이다.

## 3. 절 수(또는 절 집합)가 다른 장

| 장 | 표의 절 수 | WEB 절 마커 수 | WEB 본문 있는 절 수 | WEB 최대 절 번호 |
| --- | --- | --- | --- | --- |
{chr(10).join(row(d) for d in differing)}

나머지 {chapters - len(differing)}개 장은 절 번호 1..N 이 표와 정확히 같고 모두 본문이 있다.

관찰:
- LUK 17, ACT 8, ACT 15, ACT 24는 표와 절 수가 같지만 WEB이 그 절의 본문을 비워 둔 경우다(번호 자리만 있음).
- ROM 14, ROM 16은 송영의 위치가 달라 표 대비 절 수가 어긋난다. 번호가 같아도 내용이 다르다(예: WEB 14:24는 송영의 첫 절이다).
- 3JN 1은 WEB이 14절이고, 표가 15절로 나눈 마지막 두 절의 내용이 WEB 14절 하나에 모여 있다(WEB 14절 본문에 표의 14절과 15절 내용이 함께 있다). 14절이 존재해도 표의 14절과 같은 내용이 아니다.

## 4. 시편 표제 처리 (관찰)

WEB USFM은 시편 표제를 번호가 없는 머리글(`\\d`)로 두고 절 번호를 매기지 않는다(영어 체계). 표제가 있는 시편은 {len(psalm_titles)}개(표제 없는 시편은 {150 - len(psalm_titles)}개)이다. 표는 같은 영어 체계이므로 시편 150편 모두 절 수가 표와 일치한다(예: PSA 51은 19절, 표제는 별도). 표제는 절이 아니므로 `bible/web/PSA.json`의 장 `title`에만 두고 LLM 입력 절 목록에는 넣지 않는다. 시편 119편의 히브리 글자 머리글(ALEPH 등)도 절이 아닌 머리글이라 뺐다.

개역개정이 실제로 시편 표제를 절 번호 없이 두는지는 이 보고서에서 검증하지 못했다(docs/data-sources.md 11-3은 개역개정 표본이 영어 체계와 같다고 적지만 시편 전체를 대조한 것은 아니다).

## 5. 규칙 (코드: `AlignmentPolicy`)

QT 범위의 절이 다음 중 하나라도 있으면 그 범위 전체를 생성하지 않고 `UNAVAILABLE` + `TEXT_NOT_ALIGNED`로 응답한다.

1. WEB에 절 마커가 없거나(§1 두 번째 목록) 본문이 비어 있는 절(§1 첫 번째 목록).
2. **(보수 규칙, ai-content 제안)** 범위가 걸친 장이 §3의 구조가 다른 장인 경우. 이 장들은 번호가 존재해도 내용이 어긋날 수 있다(ROM 14·16, 3JN 1). 범위 안의 모든 절이 WEB에 있어도 생성하지 않는다.
3. 장·책이 WEB에 없는 경우, 알 수 없는 책.

앞뒤 문맥 절은 같은 책에서 범위 앞뒤 5절씩(장 경계를 넘을 수 있다)이며, 본문이 없거나 구조가 다른 장에 속한 절을 만나면 그 방향의 문맥은 거기서 멈춘다.

## 6. 이 비교가 검증하지 못하는 것 (미검증)

- **절 번호가 같은 장(1,182개) 안의 내용 정렬.** 번역마다 문장이 절 경계를 넘는 위치가 달라 개역개정의 한 절이 WEB의 두 절에 걸칠 수 있다. 이 보고서는 번호 집합만 비교했다. 앞뒤 문맥 절을 함께 입력하지만, 핵심 설명의 근거 절 하나하나가 개역개정의 같은 번호 절과 정확히 같은 내용이라고 보장하지 않는다. 대표 본문의 사람 검토가 필요하다.
- 우리 표 자체가 개역개정 전수 검증을 거치지 않은 잠정본이다(표본 확인에서 다른 지점은 REV 12 한 곳). 개역개정과 표가 다른 장이 있다면 그 장의 QT 범위는 여기서 잡히지 않는다.
- WEB 파일은 eBible이 자주 재생성한다. 여기서 저장한 데이터는 위 SHA-256의 단일 다운로드본이고, 다시 내려받으면 다를 수 있다.
"""
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text(md, encoding="utf-8")
    print(f"differing={len(differing)} empty={len(empty)} absent={len(absent_only)} extra={len(extra)}")


if __name__ == "__main__":
    sys.exit(main())
