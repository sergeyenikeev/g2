# LumeLines: Daily Blocks

Place. Clear. Glow - every day.

## Supported targets

- `generic`
- `yandex`
- `vkplay`
- `rustore`

Legacy portal builds for `crazygames`, `poki`, `itchio`, and `newgrounds` are retired and no longer maintained.

## Local development

```bash
npm install
npm run dev:generic
```

Other supported targets:

```bash
npm run dev:yandex
npm run dev:vkplay
npm run dev:rustore
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead:

```powershell
npm.cmd run test
npm.cmd run lint
```

## Tutorial mode

- Started from the main menu via `Tutorial`.
- Runs a fixed three-step onboarding flow with authored boards and highlighted placements.
- Does not spend or award tokens and does not affect best score or daily progress.

## Builds

```bash
npm run build:all
npm run build:all:mock
npm run build:generic
npm run build:yandex
npm run build:vkplay
npm run build:rustore
```

Each build outputs to `dist/<platform>`.
Rustore builds live in `dist/rustore` and can be packaged with a WebView shell for Android stores; see `docs/rustore_android.md`.

## Platform mock

`VITE_USE_PLATFORM_MOCK=1` forces local mocks. When unset, dev defaults to mocks and builds default to real SDKs.

## Quality checks

```bash
npm run test
npm run lint
```

## Upload package

For portal uploads, ship the contents of `dist/<platform>`:

- `index.html`
- generated JS/CSS/assets
- platform-specific metadata or SDK wrapper files, if required by the target platform

## Project structure

- `src/core`: game logic (board, scoring, generator)
- `src/app`: UI, renderer, tutorial flow, input, game flow
- `src/platform`: platform bridge and supported adapters
- `src/services`: storage helpers
- `tests`: unit tests (Vitest)
- `promo`: metadata and marketing assets

## Stored data keys

The following keys are stored via the platform bridge with localStorage fallback:

- `bestScore`
- `themesUnlocked`
- `dailyBest_YYYYMMDD`
- `rewardCooldownUntil`
- `runsCount`
- `settings`
- `tokens`

## SDK integration

See `PORTING_GUIDE.md`, `SDK_INTEGRATION.md`, and `SDK_INTEGRATION_MATRIX.md` for details.
