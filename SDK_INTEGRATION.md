# SDK Integration (PlatformBridge)

The game now routes all SDK calls through `PlatformBridge`.

## Key integration points
- `src/main.ts` selects an adapter via `src/platform/factory.ts`.
- `src/platform/bridge.ts` handles cooldowns, logging, storage fallback, and ad orchestration.
- `src/platform/*/adapter.ts` contains platform-specific SDK calls only for the supported targets (`generic`, `yandex`, `vkplay`, `rustore`).
- `src/app/App.ts` uses the bridge for loading, gameplay, tutorial flow, ads, storage, analytics, and happytime.
- `src/platform/yandex/adapter.ts` also handles Yandex player-data saves, SDK lifecycle events, and fullscreen requests.
- `src/app/AudioManager.ts` keeps all gameplay audio on Web Audio to avoid browser media-player UI during moderation checks.

## Tracked events
- Run flow: `startSession`, `startRun`, `endRun`, `completeTutorial`
- Reward flow: `rewardedDenied`, `rewardedUsed`
- Ads: `adRequested`, `adStarted`, `adFinished`, `adError`
- Economy: `purchaseTheme`

## Reference
- `SDK_INTEGRATION_MATRIX.md` for per-platform capability coverage.
- `PORTING_GUIDE.md` for manual SDK wiring steps.
