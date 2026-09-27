# Daily Scripture candidate catalog validation

This tool checks the shape and internal consistency of a reviewed candidate-pool manifest before a future publisher consumes it. It uses the 66 book IDs in `web/src/i18n/books.ts` for testament classification, checks unique verse references, and verifies the SHA-256 digest of each exact UTF-8 verse string.

It does **not** establish that a verse transcription is accurate, that a source is authoritative, that a translation is public domain, that a license permits this use, or that the named reviewers actually approved the content. Those require human evidence and source-specific review. Do not treat `rightsReview.status: "approved"` as an automated legal conclusion.

## Manifest contract

The production pool is a JSON object with `schemaVersion`, `poolVersion`, `translationId`, `textLanguage`, and a non-empty `candidates` array. Each candidate must have:

- a stable ID in the form `OT:PSA:23:1` and a single book/chapter/verse reference;
- exact verse text and the SHA-256 digest of that text;
- source name, absolute HTTP(S) URL, and retrieval timestamp;
- a human rights-review record with status, basis, reviewer, time, and evidence URL;
- an approved Korean explanation with reviewer and review timestamp.

Both OT and NT candidates are required. The validator deliberately does not check chapter or verse maxima because the repository has no independently verified verse-count dataset. It also does not compare text with an external Bible site.

## Run

```sh
node tools/daily-catalog/validate.mjs path/to/approved-pool.json
node --test tools/daily-catalog/validate.test.mjs
```

No production candidate manifest is checked in yet: the currently published date files are display artifacts, not an approved reusable pool. The tests use placeholder strings that are explicitly not Scripture or explanations.
