# Hermes Cowork

> A Claude-Cowork-style desktop app for [Hermes Agent](https://github.com/NousResearch/hermes-agent). Open source. Local-first. Multi-agent.

![Cowork mode screenshot](docs/screenshots/cowork.png)

## What this is

Hermes Cowork wraps the [Hermes Agent](https://github.com/NousResearch/hermes-agent) CLI in a desktop app inspired by Anthropic's Claude Cowork — three modes (Chat / Cowork / Code), plan-then-execute task flow with inline approvals, live progress, an artifacts pane, and a shared kanban board behind the scenes.

Unlike Claude Cowork, Hermes Cowork is fully open source (MIT), runs entirely local-first, and lets multiple isolated agent profiles cooperate on a single task.

## Status

**v0.1.0 — M1 release.** Ships Chat and Cowork modes for macOS Apple Silicon. Kanban CRUD, gateway management, Code mode, Windows/Linux packaging, and auto-update arrive in M2–M4. See [the design doc](docs/superpowers/specs/2026-05-08-hermes-cowork-electron-app-design.md) for the full roadmap.

## Requirements

- macOS 13+ (Apple Silicon)
- [Hermes Agent](https://hermes-agent.nousresearch.com/docs/getting-started/installation) ≥ 0.13.0 installed and on `$PATH`

## Install

Download the latest DMG from the [Releases page](https://github.com/your-org/Hermes-Cowork/releases/latest) and drag to Applications.

## Develop

```bash
pnpm install
pnpm dev
```

## Architecture

Hermes Cowork is a thin presentation layer. It supervises three Hermes processes:

- `hermes acp` (per-session) for Chat and Cowork — streamed thinking, tool calls, file diffs, approvals
- `hermes dashboard` (long-lived) for kanban, profile, gateway, settings
- `hermes gateway` (lifecycle-controlled) for messaging dispatch

Renderer is React 19 + TypeScript + Tailwind v4. See `docs/superpowers/specs/` for design and `docs/superpowers/plans/` for implementation plans.

## License

MIT
