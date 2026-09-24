#!/usr/bin/env python3
"""web/src/data/nkrvProvisional.ts (planner-core 생성, 읽기 전용)에서 QT 서비스용 장·절 수 리소스를 만든다.

  python3 services/qt/scripts/generate_verse_counts.py          # 리소스 갱신
  python3 services/qt/scripts/generate_verse_counts.py --check  # 갱신 없이 최신인지만 확인(어긋나면 종료 코드 1)

출력: services/qt/src/main/resources/bible/verse-counts.json
소비자(QT 서비스)가 소유하는 스크립트다. 원본 데이터는 복사해 고치지 않고 그대로 옮기며,
원본 형식이 바뀌어 파싱하지 못하면 조용히 넘어가지 않고 오류로 종료한다.
잠정 데이터: 개역개정 전수 미검증(원본 헤더 참고).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "web" / "src" / "data" / "nkrvProvisional.ts"
TARGET = ROOT / "services" / "qt" / "src" / "main" / "resources" / "bible" / "verse-counts.json"

BOOK = re.compile(
    r"\{\s*bookId:\s*'([1-3A-Z][A-Z0-9]{2})'\s*,\s*testament:\s*'(?:OT|NT)'\s*,\s*order:\s*(\d+)\s*,"
    r"\s*chapterVerseCounts:\s*\[([0-9,\s]+)\]\s*\}"
)


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(2)


def parse(text: str) -> dict:
    version = re.search(r"dataVersion:\s*'([^']+)'", text)
    system = re.search(r"versificationSystem:\s*'([^']+)'", text)
    if not version or not system:
        fail("dataVersion/versificationSystem not found in nkrvProvisional.ts (format changed?)")
    books = []
    for m in BOOK.finditer(text):
        counts = [int(x) for x in m.group(3).replace("\n", " ").split(",") if x.strip()]
        books.append((m.group(1), int(m.group(2)), counts))
    if len(books) != 66:
        fail(f"expected 66 books, parsed {len(books)} (format changed?)")
    if [b[1] for b in books] != list(range(1, 67)):
        fail("book order numbers are not 1..66")
    if any(not counts or any(c < 1 for c in counts) for _, _, counts in books):
        fail("empty or non-positive chapter verse count")
    return {
        "dataVersion": version.group(1),
        "versificationSystem": system.group(1),
        "provisional": True,
        "verification": "provisional; not verified against the full Korean NKRV text",
        "source": "web/src/data/nkrvProvisional.ts",
        "totalChapters": sum(len(c) for _, _, c in books),
        "totalVerses": sum(sum(c) for _, _, c in books),
        "books": {book_id: counts for book_id, _, counts in books},
    }


def render(data: dict) -> str:
    lines = ["{"]
    for key in ("dataVersion", "versificationSystem", "provisional", "verification", "source", "totalChapters", "totalVerses"):
        lines.append(f"  {json.dumps(key)}: {json.dumps(data[key], ensure_ascii=False)},")
    lines.append('  "books": {')
    items = list(data["books"].items())
    for i, (book_id, counts) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        lines.append(f"    {json.dumps(book_id)}: {json.dumps(counts)}{comma}")
    lines.append("  }")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main() -> None:
    if not SOURCE.exists():
        fail(f"source not found: {SOURCE}")
    rendered = render(parse(SOURCE.read_text(encoding="utf-8")))
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != rendered:
            print(f"out of date: run python3 services/qt/scripts/generate_verse_counts.py ({TARGET})", file=sys.stderr)
            sys.exit(1)
        print("verse-counts.json is up to date")
        return
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(rendered, encoding="utf-8")
    print(f"wrote {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
