# ADR-001: Engine and Architecture

## Context
We need a simple, offline, single-developer stack that supports drag-and-drop, grid logic, and CrazyGames SDK integration with minimal overhead.

## Decision
Use TypeScript + Vite with a custom Canvas2D renderer and a modular core logic layer. Core gameplay (board, scoring, generator, cooldowns) is pure TypeScript and isolated from UI. UI screens and input are handled via DOM + Canvas.

## Consequences
- Faster iteration and smaller bundle than a full engine.
- Game logic is testable via Vitest without browser dependencies.
- Rendering is lightweight but requires custom layout and input handling.
- Canvas effects (glow/flash) are implemented manually with shadows and overlays.
