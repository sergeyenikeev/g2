# SDK Integration Matrix

| Capability | Generic | Yandex | VK Play | Rustore |
| --- | --- | --- | --- | --- |
| init | implemented | manual steps needed | manual steps needed | manual steps needed |
| loading | stub | manual steps needed | stub | stub |
| gameplay | stub | manual steps needed | stub | stub |
| ads | not supported | manual steps needed | manual steps needed | manual steps needed |
| storage | implemented | manual steps needed | not supported | manual steps needed |
| analytics | implemented | stub | stub | stub |
| happytime | not supported | not supported | not supported | stub |
| adblock | not supported | not supported | not supported | not supported |

Notes:

- "manual steps needed" means SDK script and portal/wrapper-specific initialization are still required.
- "stub" means a safe no-op/logging implementation without a real SDK binding.
- Rustore refers to the Android WebView build described in `docs/rustore_android.md`.
