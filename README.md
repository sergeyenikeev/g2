# LumeLines: Daily Blocks

Place. Clear. Glow — every day.

## Local development

```bash
npm install
npm run dev
```

## Build for CrazyGames

```bash
npm run build
```

The production build lands in `dist/`.

## Tests

```bash
npm run test
```

## Lint

```bash
npm run lint
```

## CrazyGames SDK mock

The game uses a mock SDK by default in local development.

- Enable mock: `VITE_USE_CRAZYGAMES_MOCK=true`
- Disable mock: `VITE_USE_CRAZYGAMES_MOCK=false`

You can set this in a `.env` file or as an environment variable before running Vite.

## Upload package

Upload the contents of `dist/` to CrazyGames.

## Project structure

- `src/core`: game logic (board, scoring, generator)
- `src/app`: UI, renderer, input, game flow
- `src/services`: CrazyGames SDK wrapper + storage
- `tests`: unit tests (Vitest)
- `promo`: metadata + placeholder marketing assets

## Data keys

The following keys are stored via CrazyGames Data module (with localStorage fallback):

- `bestScore`
- `themesUnlocked`
- `dailyBest_YYYYMMDD`
- `rewardCooldownUntil`
- `runsCount`
- `settings`
- `tokens`

## SDK integration

See `SDK_INTEGRATION.md` for the full call map.
