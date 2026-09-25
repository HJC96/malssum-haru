#!/usr/bin/env python3
"""내려받은 engwebp_usfm.zip 을 서비스가 읽는 절 데이터(JSON)로 바꾼다.

변환은 '표시 기호 제거'와 공백 정리만 한다(단어를 바꾸거나 요약하지 않는다. WEB 이라는 이름을 유지하기 위한 조건).
- 남기는 것: 절 번호별 본문, 시편 표제(\\d, 번호 없는 머리글이라 절이 아님. titles 로 따로 둔다)
- 지우는 것: Strong 번호 표시(\\w 단어|strong=..\\w*), 각주(\\f..\\f*), 상호 참조(\\x..\\x*), 소제목·화자 표시·서문 줄
- 줄바꿈·문단·시행 표시는 공백 하나로 정리한다.
검증은 verify_web_data.py 가 (다른 방식의 파서로) 따로 한다.

사용:
  python3 build_web_data.py --zip engwebp_usfm.zip --provenance provenance.json --out ../src/main/resources/bible/web
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
import zipfile

BOOKS = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
         "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH "
         "1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()

# 줄 전체가 머리글·서문·화자 표시인 마커. 절 본문이 아니다.
NON_VERSE_LINE = re.compile(r"^\\(?:id|ide|h|toc\d|mt\d?|cl|ms\d?|s\d?|sp|r|is\d?|ip|ili\d?|ie|imt\d?)(?:\s|$)")
TITLE_LINE = re.compile(r"^\\d(?:\s|$)")
PARA_MARK = re.compile(r"^\\(?:p|q\d?|m|mi|pi\d?|li\d?|nb|b|pm|pmo|pmc|pmr|cls|qr|qc|qm\d?)(?:\s+|$)")
TOKEN = re.compile(r"\\c (\d+)|\\v (\d+)(?: |$)")
FOOTNOTE = re.compile(r"\\f .*?\\f\*", re.S)
XREF = re.compile(r"\\x .*?\\x\*", re.S)
WORD = re.compile(r"\\\+?w\s+([^|\\]*)\|[^\\]*\\\+?w\*")
MARKER = re.compile(r"\\\+?[A-Za-z]+\d?\*?")


def clean(text: str) -> str:
    text = FOOTNOTE.sub("", text)
    text = XREF.sub("", text)
    text = WORD.sub(r"\1", text)
    text = MARKER.sub("", text)
    text = re.sub(r"\s+", " ", text.replace(" ", " ")).strip()
    return text


def block_text(block: str) -> str:
    """\\v 와 다음 \\v/\\c 사이의 원문 블록에서 머리글 줄을 빼고 문단 표시를 걷어 한 줄로 합친다."""
    parts = []
    for line in block.splitlines():
        s = line.strip()
        if not s:
            continue
        if NON_VERSE_LINE.match(s) or TITLE_LINE.match(s):
            continue
        s = PARA_MARK.sub("", s)
        parts.append(s)
    return clean(" ".join(parts))


def parse_book(raw: str):
    raw = raw.lstrip("﻿")
    chapters = []
    cur = None
    titles_after_verse = 0
    pos = 0
    matches = list(TOKEN.finditer(raw))
    if not matches:
        raise ValueError("장/절 표시 없음")
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        body = raw[m.end():end]
        if m.group(1):
            cur = {"chapter": int(m.group(1)), "title": None, "verses": {}}
            chapters.append(cur)
            titles = [clean(PARA_MARK.sub("", l.strip()[2:])) for l in body.splitlines() if TITLE_LINE.match(l.strip())]
            if titles:
                cur["title"] = " ".join(titles)
        else:
            v = m.group(2)
            if v in cur["verses"]:
                raise ValueError(f"중복 절 {cur['chapter']}:{v}")
            cur["verses"][v] = block_text(body)
            if any(TITLE_LINE.match(l.strip()) for l in body.splitlines()):
                titles_after_verse += 1
    return chapters, titles_after_verse


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", required=True)
    ap.add_argument("--provenance", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    zpath = pathlib.Path(args.zip)
    prov = json.loads(pathlib.Path(args.provenance).read_text(encoding="utf-8"))
    sha = hashlib.sha256(zpath.read_bytes()).hexdigest()
    if sha != prov["sha256"] or zpath.stat().st_size != prov["bytes"]:
        print("zip 이 기록된 SHA-256·크기와 다릅니다. 중단합니다.", file=sys.stderr)
        return 2

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest_books = {}
    total_v = total_c = 0
    with zipfile.ZipFile(zpath) as z:
        names = {n.split("/")[-1]: n for n in z.namelist()}
        by_id = {}
        for n in names:
            m = re.match(r"^\d+-([1-3A-Z]{3})engwebp\.usfm$", n)
            if m and m.group(1) in BOOKS:
                by_id[m.group(1)] = names[n]
        missing = [b for b in BOOKS if b not in by_id]
        if missing:
            print("책 누락:", missing, file=sys.stderr)
            return 2
        for book in BOOKS:
            raw = z.read(by_id[book]).decode("utf-8")
            first = raw.lstrip("﻿").splitlines()[0]
            if not first.startswith(f"\\id {book} "):
                print(f"{book}: \\id 불일치 ({first[:20]!r})", file=sys.stderr)
                return 2
            chapters, titles_after = parse_book(raw)
            bad = [(c["chapter"], v) for c in chapters for v, t in c["verses"].items()
                   if "\\" in t or "|" in t or "strong=" in t]
            if bad:
                print(f"{book}: 남은 표시 기호 {bad[:5]}", file=sys.stderr)
                return 2
            doc = {
                "bookId": book,
                "chapters": [
                    {"chapter": c["chapter"], **({"title": c["title"]} if c["title"] else {}), "verses": c["verses"]}
                    for c in chapters
                ],
            }
            data = (json.dumps(doc, ensure_ascii=False, indent=None, separators=(",", ":")) + "\n").encode("utf-8")
            (out / f"{book}.json").write_bytes(data)
            nv = sum(len(c["verses"]) for c in chapters)
            manifest_books[book] = {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                                    "chapters": len(chapters), "verses": nv, "sourceFile": by_id[book],
                                    "titlesAfterFirstVerse": titles_after}
            total_v += nv
            total_c += len(chapters)
        copr = z.read("copr.htm")
        (out / "copr.htm").write_bytes(copr)

    manifest = {
        "translation": {"id": "WEB", "name": "World English Bible", "ebibleId": "engwebp", "license": "Public Domain",
                        "language": "en", "edition": "2020 stable text edition (eBible.org engwebp, 66-book protocanon)"},
        "source": {k: prov[k] for k in ("sourceUrl", "downloadedAt", "bytes", "sha256")},
        "sourceLastModified": prov.get("responseHeaders", {}).get("Last-Modified"),
        "transformation": "USFM markup removal and whitespace normalization only (Strong's markup, footnotes, cross references, "
                          "section headings and speaker labels removed; no word changed). Psalm superscriptions (\\d) are kept apart as "
                          "chapter titles, not verses.",
        "totals": {"books": len(BOOKS), "chapters": total_c, "verses": total_v},
        "coprHtmSha256": hashlib.sha256(copr).hexdigest(),
        "books": manifest_books,
    }
    canon = "\n".join(f"{b}:{manifest_books[b]['sha256']}" for b in BOOKS)
    manifest["dataSha256"] = hashlib.sha256(canon.encode("utf-8")).hexdigest()
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest["totals"]), manifest["dataSha256"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
