# DEVLOG

## 2025-12-31

Milestone A
- Done: Vite + TS scaffold, base HTML/CSS screens, canvas shell.
- Remaining: None.
- Risks/Debt: None.

Milestone B
- Done: Core logic modules (board, scoring, combo, RNG, generator) + unit tests.
- Remaining: None.
- Risks/Debt: None.

Milestone C
- Done: Renderer, input handling (drag + tap), menus, pause, results, themes, settings.
- Remaining: Minor UX polish (optional).
- Risks/Debt: Touch hitboxes may need tuning on some devices.

Milestone D
- Done: Storage service using CrazyGames Data module with localStorage fallback.
- Remaining: None.
- Risks/Debt: Data module behavior differs across SDK versions.

Milestone E
- Done: CrazyGames SDK wrapper, lifecycle calls, ads + adblock handling, happytime.
- Remaining: None.
- Risks/Debt: Real ad callbacks should be smoke-tested on CrazyGames.

Milestone F
- Done: Test suite, QA checklist, documentation, promo placeholders.
- Remaining: None.
- Risks/Debt: Build should be smoke-tested on CrazyGames hosting.

## 2025-12-31 (QA/Build)

- Done: `npm run test` (28/28 passed) and `npm run build` completed successfully.
- Remaining: Push to GitHub (g2) and run real CrazyGames SDK smoke test.
- Risks/Debt: Replace placeholder screenshots in `promo/` before release.
