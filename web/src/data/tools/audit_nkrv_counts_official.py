#!/usr/bin/env python3
"""Compare every chapter's final verse label against the official NKRV platform.

Only chapter references and numeric verse labels are retained. Scripture text is
neither written to disk nor printed. The existing chapter list provides the
request set; the script reports missing/extra references and count differences.

Usage:
  python3 web/src/data/tools/audit_nkrv_counts_official.py --output /tmp/nkrv-count-audit.json
"""
from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import hashlib
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[4]
DATA = ROOT / "web/src/data/nkrvProvisional.ts"
URL = "https://bible.bskorea.or.kr/bible/NKRV/{book}.{chapter}"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)
BOOK_RE = re.compile(r"\{ bookId: '([A-Z0-9]{3})'.*?chapterVerseCounts: \[([^\]]+)\] \},")
VERSE_RE = re.compile(r'id="NKRV\.([A-Z0-9]{3})\.(\d+)\.(\d+)(?:-(\d+))?"')


def load_current_counts() -> dict[str, list[int]]:
    result: dict[str, list[int]] = {}
    for book, raw_counts in BOOK_RE.findall(DATA.read_text(encoding="utf-8")):
        result[book] = [int(value.strip()) for value in raw_counts.split(",")]
    if len(result) != 66 or sum(map(len, result.values())) != 1189:
        raise RuntimeError(f"Expected 66 books and 1189 chapters; found {len(result)} books / {sum(map(len, result.values()))} chapters")
    return result


def fetch_chapter(item: tuple[str, int]) -> tuple[str, int, int, list[int]]:
    book, chapter = item
    request = urllib.request.Request(
        URL.format(book=book, chapter=chapter),
        headers={"User-Agent": UA, "Accept-Encoding": "gzip", "Accept": "text/html"},
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    payload = gzip.decompress(payload)
            html = payload.decode("utf-8", errors="replace")
            verses: set[int] = set()
            for got_book, got_chapter, start, end in VERSE_RE.findall(html):
                if got_book != book or int(got_chapter) != chapter:
                    continue
                first = int(start)
                last = int(end) if end else first
                verses.update(range(first, last + 1))
            if not verses:
                raise RuntimeError(f"No NKRV verse identifiers found for {book}.{chapter}")
            missing = sorted(set(range(1, max(verses) + 1)) - verses)
            return book, chapter, max(verses), missing
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"{book}.{chapter}: {last_error}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=pathlib.Path)
    parser.add_argument("--workers", default=4, type=int, choices=range(1, 5))
    parser.add_argument("--pause", default=0.25, type=float, help="Per-worker pause between requests")
    args = parser.parse_args()
    current = load_current_counts()
    jobs = [(book, chapter) for book, counts in current.items() for chapter in range(1, len(counts) + 1)]
    official = {book: [0] * len(counts) for book, counts in current.items()}
    gaps: list[dict[str, object]] = []
    failures: list[str] = []
    print(f"Starting official chapter-count audit: {len(jobs)} chapters, {args.workers} workers", flush=True)

    def paced_fetch(item: tuple[str, int]) -> tuple[str, int, int, list[int]]:
        result = fetch_chapter(item)
        time.sleep(args.pause)
        return result

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(paced_fetch, job): job for job in jobs}
        for completed, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            try:
                book, chapter, count, missing = future.result()
                official[book][chapter - 1] = count
                if missing:
                    gaps.append({"book": book, "chapter": chapter, "missingVerseNumbers": missing})
            except Exception as error:  # keep the audit complete; any failure prevents a clean result
                job = futures[future]
                failures.append(f"{job[0]}.{job[1]}: {error}")
            if completed % 50 == 0 or completed == len(jobs):
                print(f"Fetched {completed}/{len(jobs)} chapters", flush=True)

    differences = [
        {"book": book, "chapter": chapter, "current": old, "official": new}
        for book, counts in current.items()
        for chapter, (old, new) in enumerate(zip(counts, official[book]), start=1)
        if old != new
    ]
    canonical = ";".join(f"{book} " + " ".join(map(str, official[book])) for book in current)
    report = {
        "schema": "nkrv-official-count-audit-v1",
        "source": "https://bible.bskorea.or.kr/bible/NKRV/{book}.{chapter}",
        "translation": "New Korean Revised Version (1998)",
        "books": len(official),
        "chapters": sum(map(len, official.values())),
        "verses": sum(map(sum, official.values())),
        "oldTestamentVerses": sum(sum(counts) for index, counts in enumerate(official.values()) if index < 39),
        "newTestamentVerses": sum(sum(counts) for index, counts in enumerate(official.values()) if index >= 39),
        "counts": official,
        "differencesFromPrevious": differences,
        "chaptersWithMissingVerseNumbers": gaps,
        "failures": failures,
        "canonicalSha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
    }
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("books", "chapters", "verses", "oldTestamentVerses", "newTestamentVerses", "canonicalSha256")}, ensure_ascii=False), flush=True)
    print(f"Differences: {len(differences)}; verse-number gaps: {len(gaps)}; failures: {len(failures)}", flush=True)
    if failures:
        print("Audit incomplete; see failures in output report", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
