#!/usr/bin/env python3
"""저장한 WEB 절 데이터가 원본 USFM 을 변경한 것이 아님을 확인한다(원본 zip 이 있어야 한다).

build_web_data.py 와 다른 방식(정규식이 아니라 문자 단위 상태 기계)으로 원본에서 절별 본문을 다시 뽑아
저장된 JSON 과 절 단위로 비교한다. 추가로 다음을 확인한다.
  1. zip 의 SHA-256·크기가 provenance/manifest 와 같다.
  2. 저장된 책별 JSON 의 SHA-256 이 manifest 와 같다.
  3. 원본에서 각주·상호참조·머리글을 뺀 뒤 남는 단어(알파벳 토큰) 순서가 JSON 과 절마다 정확히 같다(단어 추가·삭제·변경 없음).

사용: python3 verify_web_data.py --zip engwebp_usfm.zip --data ../src/main/resources/bible/web
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
import zipfile

HEADING_MARKERS = {"id", "ide", "h", "toc1", "toc2", "toc3", "mt", "mt1", "mt2", "mt3", "cl", "ms", "ms1", "ms2", "s", "s1", "s2",
                   "sp", "r", "is", "is1", "ip", "ili", "ili1", "ie", "imt", "d"}
SKIP_SPAN = {"f", "x"}  # 각주, 상호참조: 짝이 되는 닫는 표시까지 통째로 건너뛴다


def extract(raw: str):
    """{ (chapter, verse): text } 와 {chapter: title} 을 반환한다. 문자 단위 상태 기계."""
    raw = raw.lstrip("\ufeff")
    i, n = 0, len(raw)
    chapter = None
    verse = None
    verses = {}
    titles = {}
    line_kind = None  # 현재 줄이 머리글이면 그 마커 이름
    skip_until = None
    buf = []

    def flush():
        pass

    while i < n:
        ch = raw[i]
        if ch == "\\":
            m = re.match(r"\\(\+?)([A-Za-z]+\d?)(\*?)", raw[i:])
            name, closing = m.group(2), m.group(3) == "*"
            i += m.end()
            if skip_until:
                if closing and name == skip_until:
                    skip_until = None
                continue
            if closing:
                continue
            if name in SKIP_SPAN:
                skip_until = name
                continue
            if name == "c":
                num = re.match(r"\s*(\d+)", raw[i:])
                chapter = int(num.group(1))
                i += num.end()
                verse = None
                line_kind = None
            elif name == "v":
                num = re.match(r"\s*(\d+)", raw[i:])
                verse = int(num.group(1))
                i += num.end()
                verses[(chapter, verse)] = []
                line_kind = None
            elif name == "w":
                i += re.match(r"\s*", raw[i:]).end()  # \w 뒤의 구분 공백은 표시의 일부
                continue
            elif name in ("wj", "qs", "k", "bk", "nd", "add", "wh"):
                continue  # 문자 서식: 안쪽 글자는 그대로 둔다(\w 의 |속성 은 아래에서 건너뜀)
            else:
                line_kind = name if name in HEADING_MARKERS else None
                if name == "d":
                    line_kind = "d"
            continue
        if skip_until:
            i += 1
            continue
        if ch == "|":  # \w 단어|strong="H1" 의 속성. 다음 백슬래시까지 버린다
            j = raw.find("\\", i)
            i = j if j != -1 else n
            continue
        if ch == "\n":
            line_kind = None
            if verse is not None:
                verses[(chapter, verse)].append(" ")
            i += 1
            continue
        if line_kind == "d":
            if verse is None:
                titles.setdefault(chapter, []).append(ch)
        elif line_kind is None and verse is not None:
            verses[(chapter, verse)].append(ch)
        i += 1
    norm = lambda parts: re.sub(r"\s+", " ", "".join(parts).replace("\u00a0", " ")).strip()
    return {k: norm(v) for k, v in verses.items()}, {k: norm(v) for k, v in titles.items()}


def words(text: str):
    return re.findall(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+", text)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", required=True)
    ap.add_argument("--data", required=True)
    args = ap.parse_args()
    data = pathlib.Path(args.data)
    manifest = json.loads((data / "manifest.json").read_text(encoding="utf-8"))
    problems = []

    zbytes = pathlib.Path(args.zip).read_bytes()
    if hashlib.sha256(zbytes).hexdigest() != manifest["source"]["sha256"] or len(zbytes) != manifest["source"]["bytes"]:
        problems.append("zip SHA-256/크기가 manifest 와 다름")

    checked = 0
    with zipfile.ZipFile(args.zip) as z:
        by_id = {}
        for name in z.namelist():
            m = re.match(r"^\d+-([1-3A-Z]{3})engwebp\.usfm$", name)
            if m:
                by_id[m.group(1)] = name
        if hashlib.sha256(z.read("copr.htm")).hexdigest() != manifest["coprHtmSha256"]:
            problems.append("copr.htm 해시 불일치")
        for book, info in manifest["books"].items():
            file_bytes = (data / f"{book}.json").read_bytes()
            if hashlib.sha256(file_bytes).hexdigest() != info["sha256"]:
                problems.append(f"{book}.json 해시 불일치")
            doc = json.loads(file_bytes)
            stored = {(c["chapter"], int(v)): t for c in doc["chapters"] for v, t in c["verses"].items()}
            stored_titles = {c["chapter"]: c["title"] for c in doc["chapters"] if "title" in c}
            ref, ref_titles = extract(z.read(by_id[book]).decode("utf-8"))
            if set(ref) != set(stored):
                problems.append(f"{book}: 절 집합 불일치 {sorted(set(ref) ^ set(stored))[:5]}")
            for key in sorted(set(ref) & set(stored)):
                checked += 1
                if ref[key] != stored[key]:
                    problems.append(f"{book} {key}: 본문 불일치")
                if words(ref[key]) != words(stored[key]):
                    problems.append(f"{book} {key}: 단어 순서 불일치")
            if ref_titles != stored_titles:
                problems.append(f"{book}: 표제 불일치")
    print(f"검사한 절 {checked}개, 문제 {len(problems)}건")
    for p in problems[:30]:
        print(" -", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
