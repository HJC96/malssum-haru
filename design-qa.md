# 성경 읽기 계획 화면 디자인 QA

- Source visual truth: `/var/folders/x7/0rsf22392432g0336fnm7g1c0000gn/T/codex-clipboard-7b7451a7-33fa-47bb-93b7-ee1dd73fb573.png` (1554 × 902 px)
- Implementation screenshot: `/private/tmp/malssum-plan-final-evidence2.png` (1918 × 1113 px browser capture)
- Combined comparison: `/private/tmp/malssum-plan-final-comparison.png`
- Viewport/state: desktop, Korean, night theme, whole Bible, chapter plan, September 2026 calendar. Browser viewport override requested 1554 × 902; macOS browser reported 1726 × 1002 CSS px at device scale 0.9. The comparison aligns the 1312 px wide workspace crops rather than claiming pixel-perfect viewport equivalence.

## Findings

No remaining actionable P0/P1/P2 visual mismatch in the two-panel workspace. The left settings and right preview are 557 px and 742 px wide in the rendered layout, matching the reference panel proportions. Both panel heights are now close (807 px and 770 px) while preserving the additional controls.

- Typography: Korean sans-serif hierarchy, bold section headings, small labels, and readable calendar text follow the reference. The app uses its locally bundled Noto Sans KR fallback.
- Spacing/layout: card widths, 13 px gutter, rounded borders, numbered steps, overview strip, and six-row calendar follow the reference. Start date, quick duration and weekday presets, progress, and export remain reachable without crowding the first screen.
- Colors: dark navy cards, subdued blue borders, light text, and violet selected states follow the reference; contrast remains readable.
- Imagery/icons: the existing night village asset is reused. Official Phosphor book, calendar, notebook, and download icons replace the initially missing overview icons.
- Copy/content: labels keep the existing real plan model. The mock shows reading entries before its stated start date; the implementation correctly leaves those dates empty and shows actual calculated ranges from September 27 onward. Chapter and verse modes remain selectable.

## Comparison history

1. Initial comparison showed missing overview icons and a left settings card substantially taller than the preview. Added icon-library components and moved start-date shortcuts and weekday presets into labeled disclosures. The final screenshot shows both cards with similar visual height and the icons present.
2. Final combined comparison checked the full workspace and focused setting/overview/calendar regions. No further layout fix was needed. The browser showed no console errors in a fresh tab.

## Interaction checks

- Chapter/verse radio switches; verse mode assigned `창세기 1:1–4:6` then `창세기 4:7–7:12`.
- The verse limitation disclosure opens on click. CSS also exposes it on hover and keyboard focus.
- Calendar month navigation, date selection, mobile settings/result switch, progress tools, and export controls remain present.
- Production build and 373 tests passed; 29 relevant UI tests passed again after the final text placement.

Final result: passed
