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

## 2026-01-01

- Done: Added WAV audio assets (music + SFX), tuned levels/pitch variation, preload audio on first gesture.
- Remaining: Recheck audio balance on mobile devices.
- Risks/Debt: None.

## 2026-01-02

Milestone A
- Done: Audited CrazyGames touchpoints: `index.html` SDK script tag, `src/app/App.ts` uses `CrazyGamesService`, `src/services/crazygames.ts` wraps `window.CrazyGames.SDK`.
- Remaining: Create PlatformBridge + adapters, move SDK usage to `src/platform/*`, update bootstrapping/builds/tests/docs.
- Risks/Debt: Non-CrazyGames SDKs require stubs + manual integration steps.

Milestone B
- Done: Added PlatformBridge + factory, generic adapter, storage fallback, shared cooldowns, debug overlay platform/cooldown stats.
- Remaining: Smoke-test gameplay flow in each platform build.
- Risks/Debt: Rewarded timing depends on portal ad callbacks (needs live verification).

Milestone C
- Done: Migrated CrazyGames SDK integration to `src/platform/crazygames/adapter.ts` and conditional SDK injection in `index.html`.
- Remaining: Verify CrazyGames real SDK callbacks match adapter assumptions.
- Risks/Debt: Data module availability differs across SDK versions.

Milestone D
- Done: Added Poki/Yandex/VK Play adapters (safe stubs + best-effort integrations) and manual wiring steps in `PORTING_GUIDE.md`.
- Remaining: Connect real SDKs in portal sandboxes and validate ads/storage.
- Risks/Debt: VK Play integration may require portal-specific bridge methods.

Milestone E
- Done: Build matrix scripts/env files, new platform tests, README + matrices/checklists/ADR updates.
- Done: `npm run test` (39/39 passed).
- Remaining: Run `npm run lint` locally for confirmation.
- Risks/Debt: None beyond portal-side SDK validation.

- Done: Added per-platform publishing instructions and release build script documentation.
- Remaining: None.
- Risks/Debt: Portal-side publishing flows may differ; validate in each developer console.

- Done: Expanded publishing guide with per-platform links, step-by-step portal choices, and metadata guidance.
- Remaining: None.
- Risks/Debt: Portal UI labels may change; verify names during upload.

- Done: Исправлена кодировка документации (PORTING_GUIDE и knowledge_base), добавлены CMD-скрипты сборки всех платформ (release и mock), проверена документация на "битые" символы.
- Remaining: None.
- Risks/Debt: Нет.

- Done: Пересоздан `PORTING_GUIDE.md` в UTF-8 без BOM, актуализирована база знаний по кодировке и повторно проверены все документы на «битые» символы.
- Remaining: None.
- Risks/Debt: Нет.

- Done: Added ru/en localization with auto language selection and settings picker.
- Done: Updated UI strings, theme shop labels, and tagline punctuation.
- Done: Added Yandex ru/en descriptions in `promo/metadata.json` and documented them in `PORTING_GUIDE.md`.
- Remaining: None.
- Risks/Debt: Confirm Yandex short/long description limits before final publish.

- Done: Added Yandex SEO/About/How-to-play texts in `promo/metadata.json` and `PORTING_GUIDE.md`.
- Remaining: None.
- Risks/Debt: Validate Yandex console character limits on upload.

- Done: Added preview/testing instructions (local dev, mocks, portal preview links) in `PORTING_GUIDE.md`.
- Remaining: None.
- Risks/Debt: Portal UI labels may change; verify during upload.

- Done: Wired Yandex SDK language detection (`ysdk.environment.i18n.lang`) into default language selection.
- Remaining: None.
- Risks/Debt: Verify exact Yandex SDK field name in sandbox if SDK updates.

- Done: Auto-load SDK scripts for Poki/Yandex/VK Play in `index.html` and updated `PORTING_GUIDE.md`.
- Remaining: None.
- Risks/Debt: Verify portal CSP allows external SDK script URLs.

- Done: Added step-by-step Yandex draft asset-load verification (DevTools Network/Console) in `PORTING_GUIDE.md`.
- Remaining: None.
- Risks/Debt: None.

- Done: Added dynamic <base> injection in `index.html` to stabilize asset paths when portal preview uses URLs without trailing slash.
- Remaining: Rebuild and reupload Yandex ZIP to verify 404s are gone.
- Risks/Debt: If portal rewrites paths, verify in preview.

- Done: Flattened Yandex build assets to dist root (no /assets) to avoid preview 404s.
- Remaining: Reupload new Yandex ZIP and verify `index-*.js` / `index-*.css` load.
- Risks/Debt: Other portals still use /assets; only Yandex is flattened.

- Done: Disabled in-game language selector for Yandex; language always comes from Yandex SDK.
- Remaining: Rebuild Yandex and verify language auto-select in draft.
- Risks/Debt: None.

## 2026-01-05

- Сделано: исправлен дефолтный заголовок на экране загрузки (полное название), обновлен чеклист Yandex, добавлены требования модерации Yandex в `PORTING_GUIDE.md`.
- Сделано: документация пересохранена в UTF-8 с BOM, обновлена база знаний по кодировке и языку ответов.
- Сделано: убрана автокапитализация заголовков, переведены названия тем на русский, усилена остановка звука при скрытии вкладки.
- Сделано: тестовый режим теперь игнорирует `import.meta.env` и берёт платформу из `process.env`, чтобы `vitest --mode yandex` не ломал проверки фабрики.
- Сделано: добавлена сборка для Newgrounds с flat assets (отдельный dist/newgrounds и скрипты).
- Сделано: добавлена сборка для itch.io (flat assets), добавлена rewarded-кнопка в меню (токены) для SDK-платформ, а на generic она скрыта и rewarded-кнопки выключены с подсказкой.
- Осталось: заменить промо-материалы (обложки/видео/гифы) на локализованные версии с точным названием.
- Риски/Долги: интерфейсы порталов могут менять названия пунктов; проверять по месту.

## 2026-01-06

- Сделано: кнопки продолжения и удвоения за рекламу скрываются на платформах без рекламы (generic), чтобы не вводить в заблуждение.
- Осталось: нет.
- Риски/долг: нет.

## 2026-01-06 (дополнение)

- Сделано: скрыта кнопка Продолжить (реклама) во всех билдах; Удвоить показывается только при доступной рекламе.
