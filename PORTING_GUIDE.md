# PORTING GUIDE

## Overview

The game selects a platform adapter via `VITE_PLATFORM` and routes SDK work through `src/platform/bridge.ts`.

Supported targets:

- `generic`
- `yandex`
- `vkplay`
- `rustore`

Retired targets:

- `crazygames`
- `poki`
- `itchio`
- `newgrounds`

## Tutorial mode

The main menu includes a built-in `Tutorial` run:

- fixed three-step authored flow;
- highlighted target placement for each lesson;
- no token farming, no best-score updates, no daily progress impact.

This mode lives in the normal app flow and does not require a separate build target.

## How to add a new platform

1. Create `src/platform/<platform>/adapter.ts` and implement the adapter contract.
2. Register the adapter in `src/platform/factory.ts`.
3. Add `.env.<platform>` with `VITE_PLATFORM=<platform>`.
4. Add `dev:<platform>` and `build:<platform>` scripts to `package.json`.
5. Update `SDK_INTEGRATION_MATRIX.md` and `PLATFORM_CHECKLIST.md`.

## PlatformBridge contract

Required behavior:

- `init()` -> initialize the SDK and throw/log on missing SDK.
- `loadingStart()` / `loadingStop()` -> loading lifecycle.
- `gameplayStart()` / `gameplayStop()` -> gameplay lifecycle.
- `showAd(type, ctx)` -> ad display with:
  - `ctx.pause()` when ad starts;
  - `ctx.grantReward()` only when rewarded success is confirmed;
  - `ctx.resume()` on finish/error.
- `canShowRewardedNow(kind)` -> shared cooldown checks.
- `markContinueUsed()` -> persist continue cooldown via `rewardCooldownUntil`.
- `storageGet` / `storageSet` -> SDK storage when available, otherwise localStorage.
- `track(eventName, payload)` -> analytics/logging.

## SDK script loading

`index.html` auto-loads SDK scripts only for the currently supported web targets:

- `yandex` -> `https://yandex.ru/games/sdk/v2`
- `vkplay` -> `https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js`

`generic` does not load any external SDK.
`rustore` relies on the Android wrapper exposing `window.RustoreBridge`; see `docs/rustore_android.md`.

## Build commands

Development:

```bash
npm run dev:generic
npm run dev:yandex
npm run dev:vkplay
npm run dev:rustore
```

Production:

```bash
npm run build:generic
npm run build:yandex
npm run build:vkplay
npm run build:rustore
```

All supported targets:

```bash
npm run build:all
```

## Release packaging

- Output lives in `dist/<platform>`.
- Zip the contents of the chosen `dist/<platform>` folder so `index.html` is at the archive root.
- For Rustore, package the web build inside the Android/WebView wrapper described in `docs/rustore_android.md`.

## Verification references

- `SDK_INTEGRATION.md`
- `SDK_INTEGRATION_MATRIX.md`
- `PLATFORM_CHECKLIST.md`
- `docs/release_checklist.md`
