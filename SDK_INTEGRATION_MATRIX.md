# SDK Integration Matrix

| Capability | CrazyGames | Poki | Yandex | VK Play | Generic | Rustore |
| --- | --- | --- | --- | --- | --- | --- |
| init | implemented | manual steps needed | manual steps needed | manual steps needed | implemented | manual steps needed |
| loading | implemented | manual steps needed | manual steps needed | stub | stub | stub |
| gameplay | implemented | manual steps needed | manual steps needed | stub | stub | stub |
| ads | implemented | manual steps needed | manual steps needed | manual steps needed | not supported | manual steps needed |
| storage | implemented | not supported | manual steps needed | not supported | implemented | manual steps needed |
| analytics | stub | stub | stub | stub | implemented | stub |
| happytime | implemented | not supported | not supported | not supported | not supported | stub |
| adblock | implemented | not supported | not supported | not supported | not supported | not supported |

Notes:
- "manual steps needed" indicates SDK script + portal-specific initialization required (see `PORTING_GUIDE.md`).
- "stub" means a safe no-op/logging implementation without real SDK support.
- The Rustore column represents the Android WebView build described in `docs/rustore_android.md` with `window.RustoreBridge` bridging (see `src/platform/rustore/adapter.ts`).
