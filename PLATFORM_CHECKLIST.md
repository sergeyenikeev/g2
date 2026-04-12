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
- Confirm SDK pause/resume events stop gameplay and audio during portal overlays, then restore them correctly.
- Midgame ad shows on results screen.
- Rewarded ads grant continue/double only after the reward callback.
- Verify progress saves through Yandex player data and survives account re-entry; fallback storage should only be used when player data is unavailable.
- Validate language auto-detection and hidden manual language selector.
- Verify mobile runs request fullscreen when gameplay starts or resumes.
- Confirm no browser/system media player appears while music is playing.
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
