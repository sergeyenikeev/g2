# Platform Checklist

## CrazyGames
- Load game and confirm loadingStart/loadingStop behavior.
- Start a run and confirm gameplayStart/gameplayStop on pause/resume.
- Trigger midgame ad on results screen; game remains responsive after ad.
- Trigger rewarded continue and double tokens; reward only granted on completion.
- Verify `rewardCooldownUntil` updates after continue.
- Check adblock banner behavior.
- Validate saves (bestScore, tokens, settings) across reloads.
- Verify touch input + drag on mobile.

## Poki
- Confirm SDK initialization and loading callbacks.
- Confirm gameplayStart/gameplayStop integration with pause/resume.
- Midgame ad shows on results screen (commercialBreak).
- Rewarded ad grants continue/double tokens only on success.
- Verify storage fallback to localStorage.
- Validate audio mute/unmute during ads.
- Verify touch input + drag on mobile.

## Yandex Games
- Confirm YaGames.init and loading ready signal.
- Confirm gameplay lifecycle integration (if GameplayAPI available).
- Midgame ad shows on results screen (showFullscreenAdv).
- Rewarded ad grants continue/double tokens only on reward.
- Verify Yandex storage get/set or localStorage fallback.
- Validate audio mute/unmute during ads.
- Verify SDK language auto-detection and language selector hidden.
- Verify Game Ready API (LoadingAPI.ready) is called after load.
- Verify audio stops on tab switch/blur and resumes correctly.
- Verify no text selection or context menu appears over the game area.
- Verify touch input + drag on mobile.

## VK Play
- Confirm bridge initialization (VKWebAppInit or portal equivalent).
- Midgame ad shows on results screen (interstitial).
- Rewarded ad grants continue/double tokens only on reward.
- Verify storage fallback to localStorage.
- Validate audio mute/unmute during ads.
- Verify touch input + drag on mobile.

## Rustore
- Confirm the Android WebView loads `dist/rustore` and exposes `window.RustoreBridge` for the web layer.
- Validate midgame and rewarded flows report success only after the native ad partner signals completion.
- Rewarded continue/double tokens should trigger only when the bridge result is positive and restore gameplay afterwards.
- Verify storageGet/storageSet/ storageRemove bridging keeps `bestScore`, `tokens`, `settings`, and `rewardCooldownUntil` in sync or falls back to localStorage.
- Check portrait orientation, hardware acceleration, and touch/drag responsiveness inside the Android shell.
- Confirm analytics/event tracking works via `track` and that `rewardCooldownUntil` behaves the same as the web builds.

## Generic
- Ensure no SDK errors in console.
- Ads are unavailable but gameplay remains fully functional.
- Verify localStorage saves (bestScore, tokens, settings).
- Confirm continue cooldown still applies after rewarded.
- Verify touch input + drag on mobile.
