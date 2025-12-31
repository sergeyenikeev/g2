# CrazyGames SDK Integration

## Initialization
- `src/app/App.ts`: `init()` calls `loadingStart()` before SDK init, then `loadingStop()` after menu is ready.
- `src/services/crazygames.ts`: wraps `CrazyGames.SDK.init()` and exposes SDK methods.

## Gameplay lifecycle
- `src/app/App.ts`: `startRun()` calls `gameplayStart()`.
- `src/app/App.ts`: `pauseGame()` / `resumeGame()` call `gameplayStop()` / `gameplayStart()`.
- `src/app/App.ts`: `endRun()` calls `gameplayStop()`.

## Ads
- `src/app/App.ts`: `requestMidgameAd()` calls `requestAd("midgame")` with callbacks.
- `src/app/App.ts`: `requestRewarded()` calls `requestAd("rewarded")` with pause/mute/resume and reward after `adFinished`.

## Adblock
- `src/app/App.ts`: `checkAdblock()` calls `hasAdblock()` and shows a soft banner.

## Happytime
- `src/app/App.ts`: `triggerHappytime()` is called on a super-combo or new best.

## Data module
- `src/app/App.ts`: storage initialized with `getDataModule()` and falls back to localStorage.
- `src/services/storage.ts`: handles get/set and JSON serialization.
