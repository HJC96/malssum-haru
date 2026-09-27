# Daily content core

Java 21 core for selecting the day's Old and New Testament passages and rendering the frontend's `DailyWordContent` v1 JSON. It has no AWS SDK, credentials, or infrastructure code. The Spring Cloud Function bean is the application entry point that a later runtime adapter can invoke; local generation works without AWS.

## Candidate approval policy

The versioned catalog in `src/main/resources/catalog/candidate-catalog-v1.json` carries a SHA-256 of every exact verse string and separate text, explanation, and rights states. A candidate is publishable only when all three states are `approved`, a reviewer is recorded, and the review date exists. Updating pool membership or order requires a new `catalogVersion`.

The two seed records were copied from existing public date files. Their approval states are deliberately `pending`: being present in the UI does not establish verse alignment, editorial review, or redistribution permission. Therefore the bundled catalog refuses to produce a public artifact until those records (or new records) receive documented approvals. This is a fail-closed data gate, not a missing selector implementation.

## Run locally

From this directory:

```sh
mvn test
mvn -q -DskipTests package
java -jar target/daily-content-0.1.0-SNAPSHOT.jar --help
```

After the catalog has both Old and New Testament candidates with approved metadata:

```sh
java -jar target/daily-content-0.1.0-SNAPSHOT.jar \
  --date=2026-10-01 \
  --output=target/generated-daily-word/2026-10-01.json

# 승인된 후보에서 14일분을 준비할 때
java -jar target/daily-content-0.1.0-SNAPSHOT.jar \
  --date=2026-10-01 --days=14 --output-dir=target/generated-daily-word
```

An existing identical file is treated as a successful retry. A different existing file is never overwritten automatically; corrections require an explicit review/versioning workflow. The CLI does not upload or publish files.

For the reviewed S3 publish path and remaining operational prerequisites, see [`docs/CONTENT_RELEASE.md`](../../docs/CONTENT_RELEASE.md).

## Selection contract

- `targetDate` is explicit and interpreted as the Seoul calendar date; no wall clock is read by selection code.
- Old and New Testament pools are sampled independently.
- The index mapping uses rejection sampling to avoid modulo bias.
- Same catalog version, algorithm version, date, and testament produce the same candidate. Repeats on adjacent dates are allowed.
- Output has only the current frontend fields: `schemaVersion`, `date`, `timeZone`, `contentVersion`, `oldTestament`, and `newTestament`.
