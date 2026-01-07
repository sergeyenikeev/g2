# LumeLines: Daily Blocks

Place. Clear. Glow - every day.

## Local development

```bash
npm install
npm run dev:generic
```

Other targets:

```bash
npm run dev:crazygames
npm run dev:poki
npm run dev:yandex
npm run dev:vkplay
npm run dev:rustore
```

## Builds

```bash
npm run build:generic
npm run build:crazygames
npm run build:poki
npm run build:yandex
npm run build:vkplay
npm run build:rustore
```

Each build outputs to `dist/<platform>`.
Rustore builds live in `dist/rustore` and can be packaged with a WebView shell for Android stores; see `docs/rustore_android.md` for the recommended workflow.

## Platform mock

`VITE_USE_PLATFORM_MOCK=1` forces local mocks. When unset, dev defaults to mocks and builds default to real SDKs.

## Tests

```bash
npm run test
```

## Lint

```bash
npm run lint
```

## Project structure

- `src/core`: game logic (board, scoring, generator)
- `src/app`: UI, renderer, input, game flow
- `src/platform`: platform bridge + adapters
- `src/services`: storage helpers
- `tests`: unit tests (Vitest)
- `promo`: metadata + placeholder marketing assets

## Data keys

The following keys are stored via the platform bridge (with localStorage fallback):

- `bestScore`
- `themesUnlocked`
- `dailyBest_YYYYMMDD`
- `rewardCooldownUntil`
- `runsCount`
- `settings`
- `tokens`

## SDK integration

See `PORTING_GUIDE.md` and `SDK_INTEGRATION_MATRIX.md` for details.
