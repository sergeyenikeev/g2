# ADR: PlatformBridge for Multi-Portal SDKs

Date: 2026-01-02
Status: Accepted

## Context
- The game was tightly coupled to CrazyGames SDK calls.
- We need a single build pipeline that targets multiple portals without backend services.

## Decision
- Introduce `PlatformBridge` with per-platform adapters under `src/platform/*`.
- Route SDK lifecycle, ads, storage, and analytics through the bridge.
- Implement rewarded and continue cooldowns in the bridge shared layer.
- Select the adapter via `VITE_PLATFORM` with optional mocks via `VITE_USE_PLATFORM_MOCK`.

## Consequences
- Game code no longer calls portal SDK globals directly.
- Each platform can be stubbed/mocked without breaking gameplay.
- Builds output to `dist/<platform>` and require manual SDK script wiring where needed.
