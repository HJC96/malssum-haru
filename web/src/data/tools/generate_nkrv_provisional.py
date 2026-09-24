#!/usr/bin/env python3
"""web/src/data/nkrvProvisional.ts 를 생성한다 (T10, docs/data-sources.md 9절).

입력: UBS versification_json 저장소의 examples/eng.vrs (고정 커밋). 네트워크는 이 스크립트를 실행할 때만 쓴다.
- 원본 파일은 저장소에 넣지 않는다. 기본은 메모리로만 내려받고, 아래 값과 다르면 중단한다.
- --input PATH 로 이미 받은 사본(scratchpad 등)을 쓸 수 있다. 같은 검증을 거친다.

사용: python3 web/src/data/tools/generate_nkrv_provisional.py [--input PATH] [--check]
  --check : 파일을 쓰지 않고 현재 저장소의 nkrvProvisional.ts 가 생성 결과와 같은지만 확인한다.
"""
import argparse
import hashlib
import pathlib
import re
import sys
import urllib.request

COMMIT = "71c66cb6ddfa6158919bc9798d124141a8168b14"
URL = f"https://raw.githubusercontent.com/ubsicap/versification_json/{COMMIT}/examples/eng.vrs"
SRC_SIZE = 18787
SRC_SHA256 = "003981c7f43c69b73b60d40a3f35f72e7ee017a686a6fb206f19a1b721157541"

BOOKS = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
    "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI "
    "2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split()
OT_COUNT = 39
OVERRIDES = {("REV", 12): 17}  # eng.vrs 18 -> 개역개정 표본과 KJV/SWORD 값 17

EXPECT = {
    "books": 66,
    "chapters": 1189,
    "verses": 31103,
    "ot_verses": 23145,
    "nt_verses": 7958,
    "orig_verses": 31104,
    "canonical_sha256": "06d08cd442227dab417f059804dc042a9039f4decd8ed7c4b69385721e55e3b5",
    "orig_canonical_sha256": "775d44f2f4228b8a602917de65169d7380a29d5d4dfd7defb9ee40c9effee185",
}

OUT = pathlib.Path(__file__).resolve().parent.parent / "nkrvProvisional.ts"
LINE = re.compile(r"^([A-Z0-9]{3}) ((?:\d+:\d+ ?)+)\s*$")


def fail(msg):
    sys.exit(f"ERROR: {msg}")


def load(path):
    if path:
        data = pathlib.Path(path).read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=30) as r:
            data = r.read()
    if len(data) != SRC_SIZE:
        fail(f"size {len(data)} != {SRC_SIZE}")
    digest = hashlib.sha256(data).hexdigest()
    if digest != SRC_SHA256:
        fail(f"sha256 {digest} != {SRC_SHA256}")
    return data.decode("utf-8")


def parse(text):
    table = {}
    for raw in text.splitlines():
        m = LINE.match(raw)
        if not m or m.group(1) not in BOOKS:
            continue
        book = m.group(1)
        if book in table:
            fail(f"duplicate book {book}")
        pairs = [tuple(int(x) for x in p.split(":")) for p in m.group(2).split()]
        for i, (chapter, _) in enumerate(pairs):
            if chapter != i + 1:
                fail(f"{book}: chapters not consecutive at {chapter}")
        table[book] = [last for _, last in pairs]
    missing = [b for b in BOOKS if b not in table]
    if missing:
        fail(f"missing books {missing}")
    return table


def canonical(table):
    return ";".join(f"{b} " + " ".join(str(n) for n in table[b]) for b in BOOKS)


def sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def totals(table):
    ot = sum(sum(table[b]) for b in BOOKS[:OT_COUNT])
    nt = sum(sum(table[b]) for b in BOOKS[OT_COUNT:])
    return ot, nt


def render(table):
    lines = [
        "// 이 파일은 web/src/data/tools/generate_nkrv_provisional.py 가 생성한다. 손으로 고치지 않는다.",
        "//",
        "// 잠정(provisional) 장절 구조 데이터: 개역개정 전수 미검증. 개역개정과 일치한다고 확정된 값이 아니다.",
        "// 표본 확인에서 다른 지점은 REV 12장(18 -> 17) 한 곳뿐이었고 그 외 장은 검증하지 않았다.",
        "// 사도행전 15:25-26(병합 표시), 24:7(개역개정에 없는 번호) 같은 절 번호는 번호 기준으로 센다(알려진 제한).",
        "//",
        "// 출처: UBS(United Bible Societies) versification_json 저장소의 examples/eng.vrs (Paratext English versification)",
        f"//   https://github.com/ubsicap/versification_json  commit {COMMIT}",
        f"//   원본 {SRC_SIZE} 바이트, SHA-256 {SRC_SHA256}",
        "//   수정: REV 12장 절 수를 18에서 17로 덮어씀. 라이선스(MIT)는 web/src/data/THIRD_PARTY_NOTICES.md 참조.",
        "// 검증값: 66권 1,189장 31,103절(구약 23,145, 신약 7,958). 정규 문자열 SHA-256은 아래 상수.",
        "// SWORD KJV canon과의 차이는 3JN 1장(15 대 14) 한 곳뿐이다.",
        "",
        "import type { BibleData } from '../domain/types';",
        "",
        f"export const NKRV_PROVISIONAL_SOURCE_COMMIT = '{COMMIT}';",
        f"export const NKRV_PROVISIONAL_SOURCE_SHA256 = '{SRC_SHA256}';",
        f"export const NKRV_PROVISIONAL_CANONICAL_SHA256 = '{EXPECT['canonical_sha256']}';",
        "",
        "export const NKRV_PROVISIONAL: BibleData = {",
        "  dataVersion: 'eng.vrs@71c66cb+REV12=17',",
        "  versificationSystem: 'nkrv-provisional-1',",
        "  books: [",
    ]
    for i, b in enumerate(BOOKS):
        t = "OT" if i < OT_COUNT else "NT"
        counts = ", ".join(str(n) for n in table[b])
        lines.append(f"    {{ bookId: '{b}', testament: '{t}', order: {i + 1}, chapterVerseCounts: [{counts}] }},")
    lines += ["  ],", "};", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    table = parse(load(args.input))
    orig_ot, orig_nt = totals(table)
    if sha(canonical(table)) != EXPECT["orig_canonical_sha256"] or orig_ot + orig_nt != EXPECT["orig_verses"]:
        fail("original table does not match expected values")
    for (book, chapter), value in OVERRIDES.items():
        table[book][chapter - 1] = value

    ot, nt = totals(table)
    chapters = sum(len(table[b]) for b in BOOKS)
    got = {"books": len(table), "chapters": chapters, "verses": ot + nt, "ot_verses": ot, "nt_verses": nt}
    for k, v in got.items():
        if v != EXPECT[k]:
            fail(f"{k}: {v} != {EXPECT[k]}")
    if sha(canonical(table)) != EXPECT["canonical_sha256"]:
        fail("canonical sha256 mismatch after override")

    out = render(table)
    if args.check:
        if OUT.read_text(encoding="utf-8") != out:
            fail(f"{OUT} differs from generated output")
        print("OK: nkrvProvisional.ts matches generated output")
        return
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({got})")


if __name__ == "__main__":
    main()
