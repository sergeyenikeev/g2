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

For Yandex Games leaderboards, set technical names in `.env.yandex`:

```env
VITE_YANDEX_LEADERBOARD_ALL_TIME=lumelines_all_time
VITE_YANDEX_LEADERBOARD_DAILY=lumelines_daily
```

Optional monetization tuning is also available through env vars:

```env
VITE_MENU_REWARD_TOKENS=3
VITE_CONTINUE_MIN_SCORE=350
VITE_DOUBLE_MIN_TOKENS=1
VITE_INTERSTITIAL_INTERVAL_RUNS=3
VITE_REWARDED_COOLDOWN_MS=90000
VITE_CONTINUE_COOLDOWN_MS=600000
```

Yandex IAP product ids default to the built-in offer ids below, but can be overridden if the console uses different ids:

```env
VITE_YANDEX_IAP_NO_ADS=no_ads
VITE_YANDEX_IAP_STARTER_PACK=starter_pack
VITE_YANDEX_IAP_THEME_BUNDLE=theme_bundle
VITE_YANDEX_IAP_TOKEN_PACK_SMALL=token_pack_small
VITE_YANDEX_IAP_TOKEN_PACK_MEDIUM=token_pack_medium
```

Current Yandex storefront offers in the `Themes` screen:

- `No Ads`: disables banner and interstitial ads, while rewarded ads stay optional.
- `Starter Pack`: `No Ads`, `120` tokens, and the exclusive `Sunset Relay` theme.
- `Theme Bundle`: unlocks `Ember Ash`, `Aqua Drift`, `Forest Pulse`, and the exclusive `Aurora Grid` theme.
- `Token Pack S`: `25` tokens.
- `Token Pack M`: `80` tokens.

Yandex account sign-in is optional: without it the game still works normally and the player can keep using the manual name field in settings. After sign-in, the player can separately choose whether to use the Yandex display name.

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead:

```powershell
npm.cmd run test
npm.cmd run lint
```

## Tutorial mode

- Started from the main menu via `Tutorial`.
- Runs a fixed three-step onboarding flow with authored boards and highlighted placements.
- Does not spend or award tokens and does not affect best score or daily progress.
- Completion is saved, and after the first pass the menu CTA changes to `Replay Tutorial`.

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
- `tutorialCompleted`
- `loginReward`
- `dailyStreak`
- `weeklyLoop`
- `journey`
- `dailyMissions`
- `settings`
- `tokens`

## SDK integration

See `PORTING_GUIDE.md`, `SDK_INTEGRATION.md`, and `SDK_INTEGRATION_MATRIX.md` for details.
