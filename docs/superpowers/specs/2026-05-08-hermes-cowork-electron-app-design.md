# Hermes Cowork — Electron Desktop App

**Status:** Draft for review
**Date:** 2026-05-08
**Owner:** @rab0493
**License (planned):** MIT — open source
**Repository:** github.com/<user>/Hermes-Cowork (working dir: `~/Repos/GitHub/Hermes-Cowork`)

## 1. Summary

Hermes Cowork is an Electron desktop application that gives [Hermes Agent](https://github.com/NousResearch/hermes-agent) the user-experience of [Anthropic's Claude Cowork](https://claude.com/product/cowork) — a three-tab Chat/Cowork/Code shell where an agent plans, gets approval, then executes multi-step tasks with live progress and an artifacts pane. On top of Claude Cowork's pattern, the app surfaces Hermes-native capabilities that have no equivalent upstream: **multi-profile fanout** (one task can spawn coordinated subagents under different `HERMES_HOME`s), a **shared Kanban board** that doubles as the Cowork progress view, **gateway status & control** (Telegram/Discord/Signal as a built-in "Dispatch" replacement), and **Insights/Memory/Skills/Cron** browsers.

The app does not fork Hermes. It is a presentation layer that talks to a stock `hermes` install through two existing surfaces: ACP (stdio JSON-RPC) for active sessions, and the dashboard REST API for everything else.

## 2. Goals & Non-Goals

### Goals

- Give Hermes users a Claude-Desktop-class native UI without leaving the open-source stack.
- Replicate Claude Cowork's plan→approve→execute UX with inline approvals, artifacts, and a live plan view.
- Expose Hermes-native primitives (profiles, kanban, gateway, skills, cron, memory, insights) as first-class navigation.
- Be installable on macOS (Apple Silicon + Intel), Windows, and Linux from the v1.0 release.
- Stay legally distinct from Anthropic's Claude Desktop: original visual identity, original copy, no logos or color tokens lifted from Anthropic.
- Keep the app a thin presentation layer — every user-visible feature must map to an existing Hermes API or CLI surface; the app does not own state.

### Non-goals

- We do not host a multi-user cloud service. "Cowork" here means *agent-with-human focused work*, not multi-human collaboration. Multi-human cowork is a future product, not v1.
- We do not reimplement Hermes capabilities in the renderer. If something needs a new endpoint, the work happens upstream in `hermes-agent`, not in this app.
- We do not ship a custom model or LLM. The app inherits whatever Hermes is configured to use.
- We do not target mobile. "Dispatch from your phone" is satisfied by Hermes' existing gateway (Telegram/Discord/Signal/SMS), surfaced in the app's UI as the Dispatch indicator.

## 3. Architecture

### 3.1 Process model

The app supervises three Hermes child processes alongside the Electron renderer. The Electron main process is the orchestrator; the renderer is a single SPA.

```
┌─────────────────── Electron main ────────────────────┐
│  Orchestrator: lifecycle, IPC routing, auto-update    │
│                                                       │
│  ├─ spawns ──▶ hermes acp           (stdio JSON-RPC) │
│  ├─ ensures ─▶ hermes dashboard     (HTTP :9119)     │
│  └─ controls ▶ hermes gateway       (REST start/stop)│
└───────────────┬───────────────────────────────────────┘
                │ contextBridge IPC
                ▼
┌─────────────────── Electron renderer ────────────────┐
│  React + TypeScript + Tailwind                        │
│  Routes: Chat, Cowork, Code, Kanban, Memory, Skills,  │
│          Cron, Insights, Settings                     │
│  State: Zustand stores per surface (chat, kanban, …)  │
└───────────────────────────────────────────────────────┘
```

### 3.2 Integration surfaces (decision: Hybrid)

| Surface | What it serves | Lifecycle |
|---|---|---|
| **ACP** (stdio) | Chat, Cowork, Code modes — message stream, tool calls, file diffs, approvals, streamed thinking | Spawned per active session; killed on session close. Multiple concurrent sessions = multiple ACP children. |
| **Dashboard REST** (HTTP :9119) | Kanban CRUD, profile list/switch/create, gateway start/stop/status, cron, sessions browse, insights, settings (`config.yaml`, `.env`) | Single long-lived child; auto-started by the app on launch, terminated on quit. |
| **Dashboard WebSocket** (`/api/plugins/kanban/events`) | Live kanban event stream for Cowork right-pane plan view + Kanban board view | Single connection, multiplexed in renderer. |
| **API Server** (HTTP :8642) | Not used in v1. Reserved for "use Hermes from external apps via OpenAI-compat" — possible export feature later. | — |

### 3.3 Why hybrid

ACP gives native chat lifecycle (streamed thinking, file diffs, approval prompts) but exposes only chat. The dashboard REST API exposes everything else but routes chat through an embedded TUI iframe — not the native feel we want. Hybrid uses each for what it's best at: ACP for the *agent's voice*, REST for the *agent's environment*.

### 3.4 Data flow: starting a Cowork task

1. User clicks **+ New task** in Cowork sidebar, types a goal, picks a folder + profile.
2. Renderer asks main to spawn an ACP child via `spawnAcpSession({ profile, cwd })`.
3. Main sets `HERMES_HOME=~/.hermes/profiles/<profile>` and runs `hermes acp`.
4. Renderer sends an ACP `prompt` message: the goal + the system instruction "you are running in Cowork mode; produce a plan first using `kanban_create` for each step".
5. Hermes plans by creating a kanban parent task + child subtasks with `kanban_create` / `kanban_link`.
6. Renderer subscribes to the dashboard kanban WebSocket; events for the new parent task ID render in the right-pane Plan view.
7. Each ACP `tool_call_update` (write_file, terminal, etc.) renders inline in the main transcript with diff/output. Approval prompts render as inline cards.
8. On approval, ACP continues; on completion the parent kanban task transitions to `done` and the right-pane Plan shows all checks.

### 3.5 Data flow: switching profiles

Profile switch is a workspace-wide change because Hermes state is `HERMES_HOME`-scoped.

1. User picks a profile in the top-left dropdown.
2. Renderer dispatches `switchProfile(name)`.
3. Main:
   - Persists the new active profile to app config.
   - Closes any open ACP children.
   - Calls `POST /api/profiles/use` on the dashboard to update `~/.hermes/active_profile`.
   - The dashboard remains the same process (it serves all profiles via query param `?profile=<name>`), so we don't restart it.
4. Renderer invalidates all queries (sessions, kanban, cron, insights) and refetches under the new profile scope.
5. Active task panes show an empty state until the user resumes a session or starts a new one.

## 4. Components

### 4.1 Main process modules

```
src/main/
  index.ts             — app bootstrap, window creation, auto-update
  orchestrator/
    hermes-runtime.ts  — find `hermes` binary; PATH probe + bundled fallback
    acp-supervisor.ts  — spawn/kill ACP children, crash detection, IPC bridge
    dashboard.ts       — start/stop dashboard, port discovery, health probe
    gateway.ts         — REST control of `hermes gateway`
  ipc/
    channels.ts        — typed IPC channel definitions (zod schemas)
    handlers.ts        — registered handlers wiring renderer → orchestrator
  store/
    app-config.ts      — electron-store: window state, active profile, settings
  updater.ts           — electron-updater + GitHub Releases auto-update
  protocol.ts          — `hermes-cowork://` URL scheme handler (deep links from gateway notifications back into the app, e.g. tapping a Telegram link opens the running task)
```

### 4.2 Renderer surfaces

```
src/renderer/
  app/
    routes.tsx         — Chat, Cowork, Code, Kanban, Memory, Skills, Cron, Insights, Settings
    layout.tsx         — TitleBar, ModeTabs, Sidebar, Main, RightPane, StatusBar
  features/
    chat/              — session list, message stream, composer
    cowork/            — task list, goal/plan/transcript, artifacts pane
    code/              — repo-aware chat with diff viewer (sibling of Chat)
    kanban/            — board view, task detail, comments, links, runs history
    profile/           — switcher dropdown, profile manager (create/clone/delete/export/import)
    gateway/           — status indicator, platform configurator (Telegram, Discord, Signal, …)
    settings/          — config.yaml editor, env vars, themes, MCP servers, providers
  shared/
    api/               — REST client + Zod-validated response types
    acp/               — ACP JSON-RPC client (over IPC)
    components/        — design system (Button, Card, Tabs, Tooltip, …)
```

### 4.3 The orchestrator's job in detail

`acp-supervisor` is the most-tested module:

- **Spawn**: invoke `hermes acp` with `HERMES_HOME` set, working directory, optional skills preload, model override.
- **Wire**: pipe stdin/stdout to JSON-RPC framing; relay messages over IPC to renderer.
- **Crash handling**: on non-zero exit during an active task, surface a "Hermes process crashed" banner with restart button; do not auto-restart silently (would mask bugs in early versions).
- **Clean shutdown**: on quit, send `shutdown` JSON-RPC, then SIGTERM, then SIGKILL with 5s timeout escalation.

`dashboard.ts`:

- **Auto-start**: probe `127.0.0.1:9119/api/status`; if absent, run `hermes dashboard --no-open --port 9119` as a child.
- **Port conflict**: if 9119 is taken by something other than Hermes (verify by `GET /api/status` shape), fall back to next free port and pass `--port` accordingly.
- **Health**: poll `/api/status` every 5s; surface degraded state in the status bar.

## 5. UI surfaces

### 5.1 Chat mode

Identical structurally to Claude Desktop's Chat: left sidebar = sessions list (grouped by source: local, telegram, discord, …), main pane = message stream with markdown + code highlighting + tool-call expansion, composer with file upload + model selector. Powered by ACP.

### 5.2 Cowork mode (centerpiece)

The mockup signed off in brainstorming. Three-pane layout:

- **Sidebar**: Cowork (+ New task, Active tasks, Scheduled, Projects) above Hermes (Kanban, Memory, Skills, Cron, Insights).
- **Main pane**: Goal header (text, working directory, profile fanout, status), live transcript with tool calls and inline approval cards, composer at the bottom.
- **Right pane**: Tabs Plan / Artifacts / Subtasks. Plan is a kanban-rendered checklist; Artifacts shows files Hermes read/wrote, clickable for preview; Subtasks lists fanned-out child profiles with their progress. Mode toggle at the bottom: "Ask before acting" vs "Act without asking".

### 5.3 Code mode

A specialization of Chat oriented around a repo-as-cwd. Adds a file tree, diff viewer for in-progress edits, and inline test output. Distinguished from Cowork by being free-form chat, not plan-driven.

### 5.4 Kanban board

Full Trello-style columns mapped to Hermes' lifecycle states (`triage / todo / ready / running / blocked / done / archived`). Drag-and-drop transitions are filtered to lifecycle-valid moves (e.g. `done → archived` is allowed; `done → ready` is not). Multi-board support with a board switcher in the header. Task detail drawer shows the same data Cowork's right pane shows for an in-flight task.

### 5.5 Profile switcher + manager

Workspace-style dropdown in the top-left. Manager (under Settings → Profiles) lists all profiles with create/clone/clone-all/rename/delete/export/import. Each profile shows: gateway status, active session count, current model.

### 5.6 Gateway management

Status indicator in the bottom status bar with green/yellow/red dot per platform. Click → modal/panel with start/stop, per-platform configuration (token, mention behavior, allow/ignore lists), recent dispatches log. Backed by dashboard REST endpoints.

### 5.7 Settings

`config.yaml` form-based editor (reusing the dashboard's schema endpoint), `.env` API-key manager, theme picker, MCP server list, model/provider configuration with credential pool view.

## 6. The Cowork experience in detail

A complete walkthrough of one task, end-to-end:

1. User opens **Cowork** tab. Empty-state shows three suggestion cards: "Organize a folder", "Crunch a CSV", "Draft a report from a template".
2. User clicks **+ New task**, picks `~/work/q2-report` as folder (folder permission prompt: read/edit/delete; one-time vs recurring), confirms profile = `research`, types the goal.
3. App sends to ACP. The system prompt for Cowork mode instructs Hermes to: (a) propose a plan as kanban subtasks, (b) wait for approval if mode = "Ask before acting", (c) emit `kanban_heartbeat` regularly, (d) write artifacts via terminal/write_file tools (these auto-appear in Artifacts pane).
4. Hermes proposes a 7-step plan. Right pane fills with steps in `todo` state. Approval prompt in main: "Run this plan?".
5. User approves. Hermes promotes step 1 to `running`, executes (e.g. fetches data via terminal tool), completes it. Right pane updates live via WebSocket.
6. At step 3, Hermes encounters a destructive operation — drops a SQL table. The Cowork system prompt forces an inline approval card regardless of mode. User redirects: "use a temp table instead". Hermes adapts.
7. Step 5 spawns the `analyst` profile via `kanban_create --assignee analyst` (parent-child link). The Subtasks tab shows analyst's progress in parallel.
8. All steps `done`. Final artifacts (draft.md, charts.png, report.pdf) listed in Artifacts pane. User clicks `report.pdf` → in-app preview.
9. User receives Telegram notification (auto-subscribed via Hermes' kanban notifier) — this *is* the Dispatch story.

## 7. Process lifecycle & supervision

| Event | Behavior |
|---|---|
| App launch | Probe + start dashboard. Restore last active profile. Do not spawn ACP until first session. |
| New session | Spawn ACP child with profile env. Track in supervisor map. |
| Session close | Send ACP `shutdown`, then SIGTERM, then SIGKILL after 5s. |
| Profile switch | Close all ACP children. Renderer invalidates all queries. Dashboard untouched. |
| Window close (macOS) | Hide window, keep dashboard running (matches platform convention). |
| App quit | Stop ACP children → stop gateway (if started by app) → stop dashboard. |
| Crash of dashboard | Status bar shows red "Hermes runtime offline" + manual restart button. No auto-restart in v1. |
| Auto-update | Download in background, prompt to relaunch on next idle. Re-spawn dashboard fresh. |

## 8. Security

- All Hermes processes bind to `127.0.0.1` only. The app does not expose any port to the network.
- The dashboard has no auth (localhost-trust model). The app respects this and never serves dashboard traffic to anything but the renderer over IPC.
- API keys live in `~/.hermes/<profile>/.env` — the app reads them through the dashboard's `/api/env` endpoint and redacts in the renderer (matching dashboard behavior).
- File access for Cowork tasks is gated by an explicit folder-permission prompt persisted per-folder. The app does not bypass Hermes' approval system.
- Auto-update payloads are signed; updater verifies signatures before applying.

## 9. Open-source posture

- **Name**: Hermes Cowork. Binary/CLI: `cowork` (short, memorable, npm/brew-friendly).
- **License**: MIT, matching upstream Hermes.
- **Visual identity**: original — no Anthropic colors, fonts, icons, or copy. Hermes-flavored dark theme as default; light theme included.
- **Repository structure**: monorepo layout (`apps/desktop`, `packages/acp-client`, `packages/api-client`, `packages/ui`) so future surfaces (CLI, web build) can reuse the same packages.
- **Distribution**: GitHub Releases (auto-update target), Homebrew Cask (mac), winget (Windows), Flathub (Linux). No paid tier.
- **Contribution**: standard OSS — issues, PRs, conventional commits, ADRs in `docs/adr/`.

## 10. Milestones

The user chose MVP-full + 3 platforms. To keep momentum, the *implementation* phases under one repo, with each milestone independently releasable:

- **M1 — Foundation + Chat + Cowork** (~4 weeks). Electron shell, orchestrator, ACP supervisor, dashboard auto-start, profile dropdown, Chat tab, Cowork tab with full plan→approve→execute. macOS only.
- **M2 — Kanban + Profiles** (~3 weeks). Kanban board view, task detail drawer, profile manager (create/clone/delete/export/import). Cowork right-pane already used kanban data — this milestone adds the dedicated board.
- **M3 — Gateway + Cron + Code + Insights + Memory + Skills** (~4 weeks). Status bar gateway control, cron form, Code mode, Insights dashboard, Memory and Skills browsers.
- **M4 — Cross-platform + polish** (~3 weeks). Windows + Linux packaging, code signing, auto-update, theme polish, accessibility audit, docs and screenshots for OSS launch.

Each milestone produces a tagged release (`v0.1`, `v0.2`, …). Public OSS launch happens at `v1.0` after M4.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| ACP API churn breaks the app between Hermes versions | Pin a tested Hermes version range in package.json; `hermes doctor` integration on first launch warns about incompatible versions. |
| Dashboard endpoints change shape | Use Zod schemas at the REST boundary; treat schema mismatches as recoverable with a "Hermes version mismatch" banner. |
| `hermes` binary not on PATH | First-launch wizard probes PATH, common install dirs (`~/.local/bin`, `/usr/local/bin`, `/opt/homebrew/bin`), `hermes-agent` Homebrew formula; offers a "Configure path" step if not found. |
| Two ACP children racing for the same kanban task | Prevented at the data layer — kanban claim is atomic. UI must tolerate "task already claimed by other profile" errors gracefully. |
| Anthropic IP concern | Original visual identity, distinct copy, no Anthropic logos. Cite Claude Cowork as inspiration in README, not as the product we're cloning. |
| Windows code signing cost / pain | Plan for EV cert in M4 budget. Until signed, ship unsigned + clear "developer build" warning on Windows. |
| Linux `node-pty` issues across distros | Avoid `node-pty` entirely (we're not embedding a TUI). All chat goes through ACP; no PTY needed. |

## 12. Testing strategy

- **Unit**: Pure logic only — orchestrator state machines, ACP message parsing, REST client schema validation, Zustand store transitions. Vitest.
- **Integration**: Spawn a real `hermes acp` child against a fixture profile in CI; assert message sequencing, plan creation, approval flow. Run on macOS + Ubuntu in CI matrix.
- **E2E**: Playwright-controlled Electron, smoke test of: launch → switch profile → start Cowork task → approve plan → see step complete → screenshot match.
- **Manual**: visual regression on the Cowork mode mockup (the design-of-record); accessibility audit (keyboard nav, ARIA, color contrast) before v1.

## 13. Out of scope (for v1)

- Mobile apps (use Hermes gateway + your phone's Telegram/Signal client).
- Multi-human cowork / cloud sync (a future product, not a v1 feature).
- Custom inference endpoints not already supported by Hermes (Hermes already supports 18+ providers).
- A web build (the same packages can power one in v2).
- Plugin/extension system inside the app (use Hermes plugins via dashboard).
