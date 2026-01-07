# Rustore / Android Packaging

This document summarizes the new Android target used for Rustore and how it keeps the existing web builds (CrazyGames, Poki, Yandex, VK Play, etc.) intact while adding an Android-compatible monetization surface.

## Build workflow

1. Run `npm run build:rustore`. The Vite build outputs into `dist/rustore` and `scripts/build-release.*` archives it as `dist/lumelines-rustore.zip` alongside the other HTML5 bundles.
2. Copy the contents of `dist/rustore` into an Android/WebView project (Capacitor, WebView activity, or any wrapper) and treat it as static assets. Keep the root `index.html` as the entry point so the existing platform detection code still runs.
3. Use a `WebView` with `setLayerType(View.LAYER_TYPE_HARDWARE, null)` (or hardware acceleration enabled) and force portrait orientation to match the web builds. Keep the viewport and input handling identical to the browser version.

## Bridge contract (`window.RustoreBridge`)

The new `src/platform/rustore/adapter.ts` expects a `RustoreBridge` implementation on `window`. The Android shell should expose the following methods (any absent method is treated as a no-op/fallback):

```ts
interface RustoreBridge {
  init?: () => Promise<void> | void;
  showAd?: (options: { type: "midgame" | "rewarded"; kind?: "continue" | "double_tokens" | "rewarded" }) =>
    Promise<{ success?: boolean; reason?: string } | boolean> | { success?: boolean; reason?: string } | boolean;
  getLanguage?: () => Promise<string | null> | string | null;
  storageGet?: (key: string) => Promise<string | null> | string | null;
  storageSet?: (key: string, value: string) => Promise<void> | void;
  storageRemove?: (key: string) => Promise<void> | void;
  track?: (eventName: string, payload?: Record<string, unknown>) => void;
}
```

The adapter calls `track` when analytics events fire, `storage*` to mirror `bestScore`, `tokens`, `settings`, and `rewardCooldownUntil`, and `showAd` for midgame/rewarded flow. `init` can be used to warm up the native ad SDK before the web layer starts calling `showAd`.

## Monetization considerations

- **Ads reuse** – The web layer continues to drive all ad placements (`midgame`, `rewarded continue`, `rewarded double tokens`). Implement `showAd` to call AdMob, Unity Ads, or another network, then resolve success/failure so `PlatformBridge` knows when to grant rewards.
- **Continue / double handling** – Rewarded ads pass `kind` to the bridge. Only grant rewards (via `ctx.grantReward`) when the native ad reports success and the adapter returns `shown: true`. `rewardCooldownUntil` is still persisted through `storageSet`.
- **Analytics** – Use the optional `track` hook to forward game-level events (session start, ad shown, reward earned) to Firebase Analytics, AppMetrica, or Rustore’s telemetry. This keeps metrics aligned with the browser builds that already log events.
- **Storage sync** – If `storageGet/storageSet` are implemented, the native layer can surface secure storage or cloud saves. Otherwise, the adapter falls back to `localStorage` so gameplay remains offline-friendly.

## Publishing to Rustore

- Zip `dist/rustore` via `scripts/build-release.*` (automatically produces `dist/lumelines-rustore.zip`).
- Provide Rustore with the same metadata stored in `promo/metadata.json` and matching screenshots to keep descriptions consistent across platforms.
- Submit the Android package (`.apk` / `.aab`) built from the WebView wrapper. Ensure orientation is locked to portrait, input/touch handling matches the browser builds, and the WebView can access local assets.

By keeping the build pipeline intact and only adding this Rustore wrapper, CrazyGames/Poki/Yandex/VK Play builds continue to work unmodified while Android players get a monetized entry point that coordinates through the same `PlatformBridge`.
