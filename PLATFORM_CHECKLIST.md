# Platform Checklist

## Generic

- Ensure no SDK errors appear in the console.
- Ads stay unavailable without breaking gameplay.
- Verify localStorage saves (`bestScore`, `tokens`, `settings`).
- Confirm touch input and drag still work on mobile.
- Check the three-step Tutorial flow from the main menu.

## Yandex Games

- Confirm `YaGames.init()` and loading ready signal.
- Confirm gameplay lifecycle integration when available.
- Midgame ad shows on results screen.
- Rewarded ads grant continue/double only after the reward callback.
- Verify Yandex storage get/set or localStorage fallback.
- Validate language auto-detection and hidden manual language selector.
- Verify touch input, drag, blur/resume, and no accidental text selection/context menu.
- Run the Tutorial flow once in the real portal shell.

## VK Play

- Confirm bridge initialization (`VKWebAppInit` or portal equivalent).
- Midgame ad shows on results screen.
- Rewarded ads grant continue/double only after success.
- Verify storage fallback to localStorage.
- Validate audio mute/unmute during ads.
- Verify touch input and drag on mobile.
- Run the Tutorial flow once in the real portal shell.

## Rustore

- Confirm the Android WebView loads `dist/rustore` and exposes `window.RustoreBridge`.
- Validate midgame and rewarded flows report success only after the native partner signals completion.
- Rewarded continue/double should trigger only when the bridge result is positive and restore gameplay afterwards.
- Verify `storageGet` / `storageSet` / `storageRemove` sync `bestScore`, `tokens`, `settings`, and `rewardCooldownUntil`.
- Check portrait orientation, hardware acceleration, and touch/drag responsiveness inside the Android shell.
- Confirm analytics/event tracking works via `track`.
- Run the Tutorial flow once on-device to verify authored hints and touch handling.
