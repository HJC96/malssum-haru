# Design QA

final result: passed

- Compared the QT screen with the user-provided parchment reference in the live Chrome preview (`http://127.0.0.1:5173/?previewDate=2026-09-26`). The generated parchment background, two-column text, section dividers, and QT provider buttons render together without the previous modern-card appearance.
- Checked the hero greeting at the top of the page; the greeting and actions are fully visible and no longer clipped by the page container.
- Checked the night theme in the browser. `web/public/shepherd-night.png` matches the user-provided 2026-09-27 00:13 image exactly (SHA-256 `24b4d1878bf7d04937a0b399cd0feb454ee19f6fb5e6eaae09dc7388f0e43ec1`). The moon, cross, landscape, and sleeping sheep are visible after switching to night mode.
- `pnpm --filter malssum-haru-web build` passed; `pnpm --filter malssum-haru-web test` passed (38 files, 373 tests); `git diff --check` passed.

The browser screenshot was inspected live during this turn; it was not exported as a separate image file.

## Missing-date behavior

- Confirmed only `web/public/daily-word/2026-09-26.json` exists. The date-specific loader correctly returns unavailable for 2026-09-27 and does not reuse the prior date.
- The 2026-09-27 browser preview now keeps the parchment and renders side-by-side Old/New Testament placeholders, with explicit missing-content and explanation copy. The 2026-09-26 preview still displays Psalm 23:1 and John 3:16 with their matching explanations.
- Focused daily-word tests pass (20 tests), and the production web build passes. Full web suite currently has 19 failures in pre-existing plan-flow/storage tests; the two daily-content tests updated for the placeholder behavior pass.
