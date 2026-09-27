# Daily Scripture candidate catalog validation

This tool validates the same versioned catalog consumed by `services/daily-content`. It uses the 66 book IDs in `web/src/i18n/books.ts` for testament classification, checks unique verse references and stable IDs, and verifies the SHA-256 digest of each exact UTF-8 verse string.

It does **not** establish that a verse transcription is accurate, that a source is authoritative, that a translation is public domain, that a license permits this use, or that the named reviewers actually approved the content. Those require human evidence and source-specific review. Do not treat `approval.rightsStatus: "approved"` as an automated legal conclusion.

## Manifest contract

The catalog is a JSON object with `catalogVersion`, `translationId`, `translationLanguage`, and a non-empty `candidates` array. Each candidate must have:

- a stable ID in the form `ot-psa-23-1` and a single book/chapter/verse reference;
- exact verse text and its SHA-256 digest;
- source name and absolute HTTP(S) URL;
- explicit text, explanation, and rights statuses (`pending`, `approved`, or `rejected`);
- explanation text and language, plus rights evidence metadata.

Both OT and NT candidates are required. `--require-approved` rejects candidates that are not fully approved. The Java publisher independently filters unapproved candidates and refuses to generate output when either testament has no approved candidate. The validator deliberately does not check chapter or verse maxima because the repository has no independently verified verse-count dataset. It also does not compare text with an external Bible site.

## Run

```sh
node tools/daily-catalog/validate.mjs path/to/approved-pool.json
node tools/daily-catalog/validate.mjs --require-approved
node --test tools/daily-catalog/validate.test.mjs
```

The default path is `services/daily-content/src/main/resources/catalog/candidate-catalog-v1.json`. Its seed examples remain pending human review, so structural validation passes while `--require-approved` fails closed. The tests use placeholder strings that are explicitly not Scripture or explanations.
