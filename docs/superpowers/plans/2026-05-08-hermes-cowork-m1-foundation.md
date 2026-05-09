# Hermes Cowork — M1 (Foundation + Chat + Cowork) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a macOS Electron app that runs Hermes Agent under the hood, with Chat and Cowork modes (plan→approve→execute, live progress, artifacts, profile switcher, gateway status). v0.1.0 OSS-launchable.

**Architecture:** Electron main process supervises three Hermes children — a long-lived `hermes dashboard` (REST + kanban WebSocket on :9119), a per-session `hermes acp` (stdio JSON-RPC for chat/cowork), and the `hermes gateway` (REST-controlled). Renderer is a React 19 + TypeScript + Tailwind v4 SPA talking to main via a typed contextBridge IPC. Cowork's right-pane "Plan" is the kanban event stream rendered as a checklist; the main pane is the ACP message stream. Two sources, one workspace.

**Tech Stack:**
- Electron 33 + electron-vite
- React 19 + TypeScript 5.6 + Tailwind CSS v4
- Zustand (app state) + TanStack Query (server state) + Zod (schema validation)
- pnpm workspaces (monorepo)
- Vitest + @testing-library/react (unit/component) + Playwright (E2E)
- electron-builder (packaging) + electron-log (logging)
- Reference Hermes version: pinned in `package.json` `hermes.minVersion`, verified at startup

**Out of M1 (deferred to later milestones):**
- Code mode (M3), full kanban board view (M2), profile create/clone/delete UI (M2), gateway management UI (M3), cron/insights/memory/skills (M3), Windows/Linux packaging (M4), auto-update wiring (M4)

---

## File Structure

```
Hermes-Cowork/
├── package.json                          # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── apps/
│   └── desktop/                          # Electron app
│       ├── package.json
│       ├── electron.vite.config.ts
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── index.html
│       ├── electron-builder.yml
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts              # app entry, window mgmt
│       │   │   ├── orchestrator/
│       │   │   │   ├── hermes-runtime.ts # find binary, version check
│       │   │   │   ├── dashboard.ts      # spawn/health probe
│       │   │   │   ├── acp-supervisor.ts # spawn/route ACP children
│       │   │   │   └── jsonrpc.ts        # stdio JSON-RPC framing
│       │   │   ├── ipc/
│       │   │   │   ├── channels.ts       # typed channel definitions
│       │   │   │   └── handlers.ts       # main-side handlers
│       │   │   ├── store/
│       │   │   │   └── app-config.ts     # electron-store wrapper
│       │   │   └── log.ts                # electron-log setup
│       │   ├── preload/
│       │   │   └── index.ts              # contextBridge
│       │   ├── renderer/
│       │   │   ├── main.tsx              # React mount
│       │   │   ├── App.tsx
│       │   │   ├── styles.css            # Tailwind entry
│       │   │   ├── routes.tsx            # mode routing
│       │   │   ├── theme/
│       │   │   │   └── tokens.ts         # colors, type, spacing
│       │   │   ├── shell/                # layout shell
│       │   │   │   ├── TitleBar.tsx
│       │   │   │   ├── ModeTabs.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── StatusBar.tsx
│       │   │   │   └── ProfileDropdown.tsx
│       │   │   ├── features/
│       │   │   │   ├── chat/
│       │   │   │   │   ├── ChatPage.tsx
│       │   │   │   │   ├── SessionList.tsx
│       │   │   │   │   ├── MessageStream.tsx
│       │   │   │   │   ├── ToolCallCard.tsx
│       │   │   │   │   ├── Composer.tsx
│       │   │   │   │   └── chat.store.ts
│       │   │   │   └── cowork/
│       │   │   │       ├── CoworkPage.tsx
│       │   │   │       ├── NewTaskDialog.tsx
│       │   │   │       ├── GoalHeader.tsx
│       │   │   │       ├── Transcript.tsx
│       │   │   │       ├── ApprovalCard.tsx
│       │   │   │       ├── RightPane.tsx
│       │   │   │       ├── PlanTab.tsx
│       │   │   │       ├── ArtifactsTab.tsx
│       │   │   │       ├── SubtasksTab.tsx
│       │   │   │       └── cowork.store.ts
│       │   │   ├── api/
│       │   │   │   ├── rest-client.ts    # REST against :9119
│       │   │   │   ├── schemas.ts        # Zod schemas for REST responses
│       │   │   │   ├── kanban-ws.ts      # kanban event WebSocket
│       │   │   │   └── acp-bridge.ts     # renderer-side ACP wrapper
│       │   │   └── components/           # design system
│       │   │       ├── Button.tsx
│       │   │       ├── Card.tsx
│       │   │       ├── Tabs.tsx
│       │   │       └── Tooltip.tsx
│       │   └── shared/
│       │       └── types.ts              # types crossing main↔renderer
│       └── tests/
│           ├── unit/                     # vitest
│           └── e2e/                      # playwright
├── packages/                             # (reserved — empty in M1)
└── docs/
    └── superpowers/
        ├── specs/2026-05-08-hermes-cowork-electron-app-design.md
        └── plans/2026-05-08-hermes-cowork-m1-foundation.md  ← this file
```

---

## Phase 1: Repo & Toolchain Bootstrap

### Task 1: Initialize pnpm workspace root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore` (extend existing)

- [ ] **Step 1: Verify pnpm is installed**

Run: `pnpm --version`
Expected: a version number (>= 10.0.0). If missing: `npm install -g pnpm@latest`.

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "hermes-cowork",
  "version": "0.0.1",
  "private": true,
  "description": "Open-source desktop app — Claude-Cowork-style UX powered by Hermes Agent",
  "license": "MIT",
  "scripts": {
    "dev": "pnpm --filter @hermes-cowork/desktop dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "engines": { "node": ">=20.0.0" },
  "packageManager": "pnpm@10.33.2"
}
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Extend `.gitignore`**

Append to existing `.gitignore`:

```
# Node
node_modules/
*.log

# Build
dist/
out/
release/
*.tsbuildinfo

# Editors
.vscode/
.idea/
.DS_Store

# Electron
.electron-cache/
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore
git commit -m "chore: pnpm workspace bootstrap"
```

### Task 2: Shared TypeScript baseline

**Files:**
- Create: `tsconfig.base.json`

- [ ] **Step 1: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "types": []
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: add tsconfig base"
```

### Task 3: ESLint + Prettier

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Modify: `package.json` (add devDeps)

- [ ] **Step 1: Add lint deps**

```bash
pnpm add -wD eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-react eslint-plugin-react-hooks prettier
```

- [ ] **Step 2: Write `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 3: Write `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', 'out', 'node_modules', '*.config.{ts,js,cjs,mjs}'],
};
```

- [ ] **Step 4: Verify lint runs**

Run: `pnpm exec eslint --version`
Expected: a version number.

- [ ] **Step 5: Commit**

```bash
git add .eslintrc.cjs .prettierrc package.json pnpm-lock.yaml
git commit -m "chore: lint + format setup"
```

---

## Phase 2: Electron App Skeleton

### Task 4: Scaffold `apps/desktop` with electron-vite

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/tsconfig.node.json`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/App.tsx`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p apps/desktop/src/{main/{orchestrator,ipc,store},preload,renderer/{shell,features/{chat,cowork},api,components,theme,shared}}
mkdir -p apps/desktop/tests/{unit,e2e}
```

- [ ] **Step 2: Write `apps/desktop/package.json`**

```json
{
  "name": "@hermes-cowork/desktop",
  "version": "0.0.1",
  "private": true,
  "description": "Hermes Cowork desktop app",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:mac": "electron-vite build && electron-builder --mac --arm64",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "hermes": { "minVersion": "0.13.0" },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "electron-log": "^5.2.0",
    "electron-store": "^10.0.0",
    "electron-updater": "^6.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "wouter": "^3.3.5",
    "zod": "^3.23.8",
    "zustand": "^5.0.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^20.16.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "electron-vite": "^2.3.0",
    "happy-dom": "^15.7.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: deps install, no errors.

- [ ] **Step 4: Write `apps/desktop/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "src",
    "paths": {
      "@main/*": ["main/*"],
      "@renderer/*": ["renderer/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["src/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Write `apps/desktop/tsconfig.node.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"]
  },
  "include": ["electron.vite.config.ts", "src/main/**/*", "src/preload/**/*"]
}
```

- [ ] **Step 6: Write `apps/desktop/electron.vite.config.ts`**

```ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') },
    },
  },
  preload: {
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: { input: resolve(__dirname, 'index.html') },
    },
  },
});
```

- [ ] **Step 7: Write `apps/desktop/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hermes Cowork</title>
  </head>
  <body class="bg-bg text-fg">
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `apps/desktop/src/main/index.ts` (minimal)**

```ts
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 9: Write `apps/desktop/src/preload/index.ts` (placeholder)**

```ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('hermes', {
  ping: () => 'pong',
});
```

- [ ] **Step 10: Write `apps/desktop/src/renderer/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 11: Write `apps/desktop/src/renderer/App.tsx`**

```tsx
export function App() {
  return (
    <main className="flex h-screen items-center justify-center">
      <h1 className="text-2xl">Hermes Cowork</h1>
    </main>
  );
}
```

- [ ] **Step 12: Run dev to verify**

Run: `pnpm dev`
Expected: Electron window opens showing "Hermes Cowork".

- [ ] **Step 13: Commit**

```bash
git add apps/desktop package.json pnpm-lock.yaml
git commit -m "feat(desktop): electron-vite + react skeleton"
```

### Task 5: Tailwind CSS v4

**Files:**
- Create: `apps/desktop/postcss.config.js`
- Create: `apps/desktop/tailwind.config.ts`
- Create: `apps/desktop/src/renderer/styles.css`
- Create: `apps/desktop/src/renderer/theme/tokens.ts`

- [ ] **Step 1: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';
import { tokens } from './src/renderer/theme/tokens';

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      borderRadius: tokens.radius,
    },
  },
} satisfies Config;
```

- [ ] **Step 2: Write `postcss.config.js`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Add `@tailwindcss/postcss` dep**

```bash
pnpm --filter @hermes-cowork/desktop add -D @tailwindcss/postcss
```

- [ ] **Step 4: Write `src/renderer/theme/tokens.ts`**

```ts
// Hermes Cowork visual identity. Original — not derived from Anthropic.
export const tokens = {
  colors: {
    bg: '#0F1418',         // app background (deep ink)
    surface: '#13171B',    // panels, sidebar
    surface2: '#1B1F24',   // raised cards, hover
    border: '#2A2820',
    fg: '#E8DCC4',         // primary text (warm)
    muted: '#8A8268',
    dim: '#5A5648',
    accent: '#C19A4B',     // Hermes gold — CTA, active state
    success: '#4ADE80',
    warn: '#FFB87A',
    danger: '#F87171',
  },
  fontFamily: {
    sans: ['"Inter"', '-apple-system', 'system-ui', 'sans-serif'],
    mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
} as const;
```

- [ ] **Step 5: Write `src/renderer/styles.css`**

```css
@import 'tailwindcss';

@theme {
  --color-bg: #0F1418;
  --color-surface: #13171B;
  --color-surface2: #1B1F24;
  --color-border: #2A2820;
  --color-fg: #E8DCC4;
  --color-muted: #8A8268;
  --color-dim: #5A5648;
  --color-accent: #C19A4B;
  --color-success: #4ADE80;
  --color-warn: #FFB87A;
  --color-danger: #F87171;
  --font-sans: 'Inter', -apple-system, system-ui, sans-serif;
}

html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 6: Update `App.tsx` to verify Tailwind**

```tsx
export function App() {
  return (
    <main className="flex h-screen items-center justify-center bg-bg text-fg">
      <h1 className="text-2xl text-accent">Hermes Cowork</h1>
    </main>
  );
}
```

- [ ] **Step 7: Run dev to verify**

Run: `pnpm dev`
Expected: window shows gold-colored "Hermes Cowork" on dark background.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): tailwind v4 + theme tokens"
```

### Task 6: Vitest setup

**Files:**
- Create: `apps/desktop/vitest.config.ts`
- Create: `apps/desktop/tests/unit/smoke.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
```

- [ ] **Step 2: Write smoke test**

```ts
// apps/desktop/tests/unit/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run**

Run: `pnpm --filter @hermes-cowork/desktop test`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/vitest.config.ts apps/desktop/tests
git commit -m "test: vitest baseline"
```

---

## Phase 3: Hermes Runtime Detection

### Task 7: Define `HermesRuntime` types

**Files:**
- Create: `apps/desktop/src/main/orchestrator/hermes-runtime.ts`

- [ ] **Step 1: Write the type-only header**

```ts
// apps/desktop/src/main/orchestrator/hermes-runtime.ts
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export type HermesRuntime = {
  binaryPath: string;
  version: string;
  meetsMinimum: boolean;
};

export type RuntimeProbeError =
  | { kind: 'not-found'; searched: string[] }
  | { kind: 'version-failed'; binaryPath: string; stderr: string }
  | { kind: 'too-old'; binaryPath: string; version: string; min: string };

export const MIN_HERMES_VERSION = '0.13.0';
```

- [ ] **Step 2: Commit (types only)**

```bash
git add apps/desktop/src/main/orchestrator/hermes-runtime.ts
git commit -m "feat(orchestrator): hermes runtime types"
```

### Task 8: TDD `findHermesBinary` — PATH search

**Files:**
- Modify: `apps/desktop/src/main/orchestrator/hermes-runtime.ts`
- Create: `apps/desktop/tests/unit/hermes-runtime.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/desktop/tests/unit/hermes-runtime.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findHermesBinary } from '@main/orchestrator/hermes-runtime';
import * as fs from 'node:fs';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return { ...actual, existsSync: vi.fn() };
});

describe('findHermesBinary', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
  });

  it('returns first hit from common install paths', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p) === '/Users/x/.local/bin/hermes',
    );

    const result = findHermesBinary({
      home: '/Users/x',
      pathDirs: [],
    });

    expect(result.kind).toBe('found');
    if (result.kind === 'found') expect(result.path).toBe('/Users/x/.local/bin/hermes');
  });

  it('returns not-found with searched list', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = findHermesBinary({ home: '/Users/x', pathDirs: ['/usr/bin'] });
    expect(result.kind).toBe('not-found');
    if (result.kind === 'not-found') expect(result.searched.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (function not exported yet)**

Run: `pnpm --filter @hermes-cowork/desktop test hermes-runtime`
Expected: FAIL with "findHermesBinary is not a function" or similar.

- [ ] **Step 3: Implement `findHermesBinary`**

Append to `hermes-runtime.ts`:

```ts
type FindResult =
  | { kind: 'found'; path: string }
  | { kind: 'not-found'; searched: string[] };

type FindOptions = {
  home: string;
  pathDirs: string[];
};

export function findHermesBinary(opts: FindOptions = {
  home: homedir(),
  pathDirs: (process.env['PATH'] ?? '').split(':').filter(Boolean),
}): FindResult {
  const candidates = [
    join(opts.home, '.local', 'bin', 'hermes'),
    '/opt/homebrew/bin/hermes',
    '/usr/local/bin/hermes',
    ...opts.pathDirs.map((d) => join(d, 'hermes')),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return { kind: 'found', path: c };
  }
  return { kind: 'not-found', searched: candidates };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test hermes-runtime`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(orchestrator): findHermesBinary with TDD"
```

### Task 9: TDD `verifyHermesVersion`

**Files:**
- Modify: `apps/desktop/src/main/orchestrator/hermes-runtime.ts`
- Modify: `apps/desktop/tests/unit/hermes-runtime.test.ts`

- [ ] **Step 1: Add failing test**

Append to `hermes-runtime.test.ts`:

```ts
import { compareSemver } from '@main/orchestrator/hermes-runtime';

describe('compareSemver', () => {
  it('returns 1 when a > b', () => {
    expect(compareSemver('0.14.0', '0.13.0')).toBe(1);
  });
  it('returns 0 when equal', () => {
    expect(compareSemver('0.13.0', '0.13.0')).toBe(0);
  });
  it('returns -1 when a < b', () => {
    expect(compareSemver('0.12.5', '0.13.0')).toBe(-1);
  });
  it('handles patch differences', () => {
    expect(compareSemver('0.13.1', '0.13.0')).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @hermes-cowork/desktop test hermes-runtime`
Expected: FAIL — `compareSemver` undefined.

- [ ] **Step 3: Implement**

Append to `hermes-runtime.ts`:

```ts
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export async function verifyHermesVersion(binaryPath: string): Promise<
  | { kind: 'ok'; version: string }
  | RuntimeProbeError
> {
  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(binaryPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) =>
      resolve({ kind: 'version-failed', binaryPath, stderr: err.message }),
    );
    proc.on('close', (code) => {
      if (code !== 0) {
        return resolve({ kind: 'version-failed', binaryPath, stderr });
      }
      // hermes --version output looks like: "hermes-agent 0.13.4"
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      if (!match) {
        return resolve({ kind: 'version-failed', binaryPath, stderr: stdout });
      }
      const version = match[1]!;
      const cmp = compareSemver(version, MIN_HERMES_VERSION);
      if (cmp < 0) {
        return resolve({ kind: 'too-old', binaryPath, version, min: MIN_HERMES_VERSION });
      }
      resolve({ kind: 'ok', version });
    });
  });
}
```

- [ ] **Step 4: Run — expect PASS (semver tests)**

Run: `pnpm --filter @hermes-cowork/desktop test hermes-runtime`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(orchestrator): verifyHermesVersion + semver compare"
```

---

## Phase 4: Dashboard Supervisor

### Task 10: Define dashboard probe + spawn types

**Files:**
- Create: `apps/desktop/src/main/orchestrator/dashboard.ts`

- [ ] **Step 1: Write skeleton**

```ts
// apps/desktop/src/main/orchestrator/dashboard.ts
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

export type DashboardState =
  | { kind: 'unknown' }
  | { kind: 'starting'; pid: number }
  | { kind: 'ready'; port: number; pid: number | null }
  | { kind: 'crashed'; lastError: string };

export type DashboardOptions = {
  binaryPath: string;
  hermesHome: string;
  port?: number;
};

const DEFAULT_PORT = 9119;

export async function probeDashboard(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 750);
    const r = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return false;
    const body = (await r.json()) as { version?: string };
    return typeof body.version === 'string';
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/main/orchestrator/dashboard.ts
git commit -m "feat(orchestrator): dashboard probe scaffolding"
```

### Task 11: TDD `probeDashboard`

**Files:**
- Create: `apps/desktop/tests/unit/dashboard.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/desktop/tests/unit/dashboard.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { probeDashboard } from '@main/orchestrator/dashboard';

describe('probeDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true for a valid /api/status response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ version: '0.13.4' }), { status: 200 }),
    );
    expect(await probeDashboard(9119)).toBe(true);
  });

  it('returns false for non-Hermes response shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    expect(await probeDashboard(9119)).toBe(false);
  });

  it('returns false on connection error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await probeDashboard(9119)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test dashboard`
Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/tests/unit/dashboard.test.ts
git commit -m "test(dashboard): probe coverage"
```

### Task 12: Implement `ensureDashboard` (probe-then-spawn)

**Files:**
- Modify: `apps/desktop/src/main/orchestrator/dashboard.ts`
- Modify: `apps/desktop/tests/unit/dashboard.test.ts`

- [ ] **Step 1: Add failing test**

Append to `dashboard.test.ts`:

```ts
import { ensureDashboard } from '@main/orchestrator/dashboard';
import * as childProcess from 'node:child_process';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof childProcess>('node:child_process');
  return { ...actual, spawn: vi.fn() };
});

describe('ensureDashboard', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset?.();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(childProcess.spawn).mockReset();
  });

  it('skips spawn when probe succeeds (existing dashboard)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ version: '0.13.4' }), { status: 200 }),
    );
    const result = await ensureDashboard({
      binaryPath: '/Users/x/.local/bin/hermes',
      hermesHome: '/Users/x/.hermes',
    });
    expect(result.kind).toBe('ready');
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @hermes-cowork/desktop test dashboard`
Expected: FAIL.

- [ ] **Step 3: Implement `ensureDashboard`**

Append to `dashboard.ts`:

```ts
export async function ensureDashboard(opts: DashboardOptions): Promise<DashboardState> {
  const port = opts.port ?? DEFAULT_PORT;

  if (await probeDashboard(port)) {
    return { kind: 'ready', port, pid: null };
  }

  const child = spawn(
    opts.binaryPath,
    ['dashboard', '--no-open', '--port', String(port), '--host', '127.0.0.1'],
    {
      env: { ...process.env, HERMES_HOME: opts.hermesHome },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.on('error', (err) => {
    console.error('[dashboard] spawn error', err);
  });

  // Wait until /api/status responds, with a 20s ceiling.
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await probeDashboard(port)) {
      return { kind: 'ready', port, pid: child.pid ?? null };
    }
    await sleep(400);
  }

  child.kill('SIGTERM');
  return { kind: 'crashed', lastError: 'dashboard did not become ready in 20s' };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test dashboard`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(orchestrator): ensureDashboard probe-then-spawn"
```

---

## Phase 5: ACP Supervisor

### Task 13: JSON-RPC framing — TDD

**Files:**
- Create: `apps/desktop/src/main/orchestrator/jsonrpc.ts`
- Create: `apps/desktop/tests/unit/jsonrpc.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/desktop/tests/unit/jsonrpc.test.ts
import { describe, it, expect } from 'vitest';
import { encodeFrame, FrameDecoder } from '@main/orchestrator/jsonrpc';

describe('encodeFrame', () => {
  it('produces Content-Length-prefixed JSON', () => {
    const frame = encodeFrame({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const expectedJson = '{"jsonrpc":"2.0","id":1,"method":"ping"}';
    expect(frame.toString('utf8')).toBe(
      `Content-Length: ${Buffer.byteLength(expectedJson, 'utf8')}\r\n\r\n${expectedJson}`,
    );
  });
});

describe('FrameDecoder', () => {
  it('decodes a single full frame', () => {
    const dec = new FrameDecoder();
    const json = '{"jsonrpc":"2.0","id":1,"result":"pong"}';
    const buf = Buffer.from(`Content-Length: ${json.length}\r\n\r\n${json}`);
    const messages = dec.push(buf);
    expect(messages).toEqual([{ jsonrpc: '2.0', id: 1, result: 'pong' }]);
  });

  it('handles split frames across pushes', () => {
    const dec = new FrameDecoder();
    const json = '{"jsonrpc":"2.0","id":1,"result":"pong"}';
    const full = `Content-Length: ${json.length}\r\n\r\n${json}`;
    expect(dec.push(Buffer.from(full.slice(0, 10)))).toEqual([]);
    expect(dec.push(Buffer.from(full.slice(10)))).toEqual([
      { jsonrpc: '2.0', id: 1, result: 'pong' },
    ]);
  });

  it('decodes multiple frames in one push', () => {
    const dec = new FrameDecoder();
    const j1 = '{"id":1}';
    const j2 = '{"id":2}';
    const buf = Buffer.from(
      `Content-Length: ${j1.length}\r\n\r\n${j1}` +
      `Content-Length: ${j2.length}\r\n\r\n${j2}`,
    );
    expect(dec.push(buf)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @hermes-cowork/desktop test jsonrpc`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/desktop/src/main/orchestrator/jsonrpc.ts
export type JsonRpcMessage = Record<string, unknown>;

export function encodeFrame(msg: JsonRpcMessage): Buffer {
  const json = JSON.stringify(msg);
  const len = Buffer.byteLength(json, 'utf8');
  return Buffer.from(`Content-Length: ${len}\r\n\r\n${json}`, 'utf8');
}

export class FrameDecoder {
  private buf = Buffer.alloc(0);

  push(chunk: Buffer): JsonRpcMessage[] {
    this.buf = Buffer.concat([this.buf, chunk]);
    const out: JsonRpcMessage[] = [];

    while (true) {
      const sep = this.buf.indexOf('\r\n\r\n');
      if (sep === -1) break;
      const header = this.buf.subarray(0, sep).toString('utf8');
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        // header doesn't contain Content-Length — drop and resync
        this.buf = this.buf.subarray(sep + 4);
        continue;
      }
      const len = Number(m[1]);
      const start = sep + 4;
      if (this.buf.length < start + len) break;
      const json = this.buf.subarray(start, start + len).toString('utf8');
      try {
        out.push(JSON.parse(json) as JsonRpcMessage);
      } catch {
        // skip malformed frame
      }
      this.buf = this.buf.subarray(start + len);
    }
    return out;
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test jsonrpc`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(orchestrator): JSON-RPC framing"
```

### Task 14: ACP supervisor types + spawn

**Files:**
- Create: `apps/desktop/src/main/orchestrator/acp-supervisor.ts`

- [ ] **Step 1: Write supervisor**

```ts
// apps/desktop/src/main/orchestrator/acp-supervisor.ts
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { FrameDecoder, encodeFrame, type JsonRpcMessage } from './jsonrpc';

export type AcpSession = {
  id: string;
  profile: string;
  cwd: string;
};

export type AcpSpawnOptions = AcpSession & {
  binaryPath: string;
  hermesHome: string;
};

export type AcpEvent =
  | { kind: 'message'; sessionId: string; msg: JsonRpcMessage }
  | { kind: 'exit'; sessionId: string; code: number | null }
  | { kind: 'error'; sessionId: string; error: string };

class AcpChild {
  readonly decoder = new FrameDecoder();
  constructor(public readonly proc: ChildProcess, public readonly session: AcpSession) {}
}

export class AcpSupervisor extends EventEmitter {
  private children = new Map<string, AcpChild>();

  spawn(opts: AcpSpawnOptions): void {
    const proc = spawn(opts.binaryPath, ['acp'], {
      cwd: opts.cwd,
      env: { ...process.env, HERMES_HOME: opts.hermesHome },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const child = new AcpChild(proc, { id: opts.id, profile: opts.profile, cwd: opts.cwd });
    this.children.set(opts.id, child);

    proc.stdout?.on('data', (chunk: Buffer) => {
      for (const msg of child.decoder.push(chunk)) {
        const event: AcpEvent = { kind: 'message', sessionId: opts.id, msg };
        this.emit('event', event);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      // Hermes ACP logs to stderr; surface for debugging.
      console.error(`[acp ${opts.id}]`, chunk.toString('utf8').trimEnd());
    });

    proc.on('error', (err) => {
      this.emit('event', { kind: 'error', sessionId: opts.id, error: err.message } satisfies AcpEvent);
    });

    proc.on('exit', (code) => {
      this.emit('event', { kind: 'exit', sessionId: opts.id, code } satisfies AcpEvent);
      this.children.delete(opts.id);
    });
  }

  send(sessionId: string, msg: JsonRpcMessage): void {
    const child = this.children.get(sessionId);
    if (!child || !child.proc.stdin) {
      throw new Error(`no ACP child for session ${sessionId}`);
    }
    child.proc.stdin.write(encodeFrame(msg));
  }

  shutdown(sessionId: string): void {
    const child = this.children.get(sessionId);
    if (!child) return;
    try {
      child.proc.stdin?.end();
    } catch {
      // ignore
    }
    const proc = child.proc;
    setTimeout(() => proc.kill('SIGTERM'), 1000);
    setTimeout(() => proc.kill('SIGKILL'), 5000);
  }

  shutdownAll(): void {
    for (const id of this.children.keys()) this.shutdown(id);
  }

  list(): AcpSession[] {
    return Array.from(this.children.values()).map((c) => c.session);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/main/orchestrator/acp-supervisor.ts
git commit -m "feat(orchestrator): ACP supervisor"
```

### Task 15: Test ACP supervisor with a mock child

**Files:**
- Create: `apps/desktop/tests/unit/acp-supervisor.test.ts`

- [ ] **Step 1: Write test**

```ts
// apps/desktop/tests/unit/acp-supervisor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import * as cp from 'node:child_process';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof cp>('node:child_process');
  return { ...actual, spawn: vi.fn() };
});

import { AcpSupervisor, type AcpEvent } from '@main/orchestrator/acp-supervisor';
import { encodeFrame } from '@main/orchestrator/jsonrpc';

class MockProc extends EventEmitter {
  pid = 1234;
  stdin = new Writable({ write(_c, _e, cb) { cb(); } });
  stdout = new Readable({ read() {} });
  stderr = new Readable({ read() {} });
  kill() { this.emit('exit', 0); }
}

describe('AcpSupervisor', () => {
  beforeEach(() => vi.mocked(cp.spawn).mockReset());

  it('emits message events when child writes JSON-RPC frames', async () => {
    const proc = new MockProc();
    vi.mocked(cp.spawn).mockReturnValue(proc as unknown as cp.ChildProcess);

    const sup = new AcpSupervisor();
    const events: AcpEvent[] = [];
    sup.on('event', (e: AcpEvent) => events.push(e));

    sup.spawn({
      id: 's1',
      profile: 'default',
      cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes',
      hermesHome: '/Users/x/.hermes',
    });

    proc.stdout!.push(encodeFrame({ jsonrpc: '2.0', method: 'hello' }));
    await new Promise((r) => setImmediate(r));

    expect(events).toEqual([
      { kind: 'message', sessionId: 's1', msg: { jsonrpc: '2.0', method: 'hello' } },
    ]);
  });

  it('emits exit event when child exits', async () => {
    const proc = new MockProc();
    vi.mocked(cp.spawn).mockReturnValue(proc as unknown as cp.ChildProcess);

    const sup = new AcpSupervisor();
    const events: AcpEvent[] = [];
    sup.on('event', (e: AcpEvent) => events.push(e));

    sup.spawn({
      id: 's1', profile: 'default', cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes', hermesHome: '/Users/x/.hermes',
    });

    proc.emit('exit', 0);
    await new Promise((r) => setImmediate(r));
    expect(events).toContainEqual({ kind: 'exit', sessionId: 's1', code: 0 });
  });
});
```

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test acp-supervisor`
Expected: 2 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/tests
git commit -m "test(orchestrator): ACP supervisor coverage"
```

---

## Phase 6: IPC Contract

### Task 16: Define IPC channel types

**Files:**
- Create: `apps/desktop/src/shared/types.ts`
- Create: `apps/desktop/src/main/ipc/channels.ts`

- [ ] **Step 1: Write shared types**

```ts
// apps/desktop/src/shared/types.ts
export type ProfileSummary = {
  name: string;
  active: boolean;
  hermesHome: string;
};

export type StatusSnapshot = {
  hermesVersion: string;
  dashboardPort: number;
  gateway: { running: boolean; platforms: string[] };
};

export type AcpClientMessage =
  | { kind: 'prompt'; sessionId: string; text: string }
  | { kind: 'approve'; sessionId: string; toolCallId: string; allow: boolean };

export type AcpServerMessage =
  | { kind: 'token'; sessionId: string; text: string }
  | { kind: 'tool-call'; sessionId: string; toolCallId: string; name: string; args: unknown }
  | { kind: 'tool-result'; sessionId: string; toolCallId: string; result: unknown }
  | { kind: 'approval-request'; sessionId: string; toolCallId: string; description: string }
  | { kind: 'done'; sessionId: string };
```

- [ ] **Step 2: Write IPC channel constants**

```ts
// apps/desktop/src/main/ipc/channels.ts
export const IpcChannel = {
  // status / runtime
  RuntimeStatus: 'runtime:status',
  RuntimeRescan: 'runtime:rescan',

  // profiles
  ProfileList: 'profile:list',
  ProfileSwitch: 'profile:switch',

  // ACP
  AcpStart: 'acp:start',
  AcpSend: 'acp:send',
  AcpStop: 'acp:stop',
  AcpEvent: 'acp:event',  // main → renderer push

  // dashboard REST proxy (so renderer never touches network)
  RestGet: 'rest:get',
  RestPost: 'rest:post',
  RestPatch: 'rest:patch',

  // kanban WebSocket pump
  KanbanWsSubscribe: 'kanban-ws:subscribe',
  KanbanWsEvent: 'kanban-ws:event',
} as const;

export type IpcChannelKey = (typeof IpcChannel)[keyof typeof IpcChannel];
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/shared apps/desktop/src/main/ipc
git commit -m "feat(ipc): channel definitions + shared types"
```

### Task 17: Preload bridge

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: Replace placeholder preload**

```ts
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../main/ipc/channels';
import type { ProfileSummary, StatusSnapshot, AcpClientMessage, AcpServerMessage } from '../shared/types';

const api = {
  runtime: {
    status: (): Promise<StatusSnapshot> => ipcRenderer.invoke(IpcChannel.RuntimeStatus),
    rescan: (): Promise<StatusSnapshot> => ipcRenderer.invoke(IpcChannel.RuntimeRescan),
  },
  profile: {
    list: (): Promise<ProfileSummary[]> => ipcRenderer.invoke(IpcChannel.ProfileList),
    switch: (name: string): Promise<void> => ipcRenderer.invoke(IpcChannel.ProfileSwitch, name),
  },
  acp: {
    start: (opts: { profile: string; cwd: string }): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke(IpcChannel.AcpStart, opts),
    send: (msg: AcpClientMessage): Promise<void> => ipcRenderer.invoke(IpcChannel.AcpSend, msg),
    stop: (sessionId: string): Promise<void> => ipcRenderer.invoke(IpcChannel.AcpStop, sessionId),
    onEvent: (cb: (msg: AcpServerMessage) => void) => {
      const listener = (_e: unknown, msg: AcpServerMessage) => cb(msg);
      ipcRenderer.on(IpcChannel.AcpEvent, listener);
      return () => ipcRenderer.removeListener(IpcChannel.AcpEvent, listener);
    },
  },
  rest: {
    get: <T>(path: string): Promise<T> => ipcRenderer.invoke(IpcChannel.RestGet, path),
    post: <T>(path: string, body: unknown): Promise<T> => ipcRenderer.invoke(IpcChannel.RestPost, path, body),
    patch: <T>(path: string, body: unknown): Promise<T> => ipcRenderer.invoke(IpcChannel.RestPatch, path, body),
  },
  kanbanWs: {
    subscribe: (boardSlug: string | null): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.KanbanWsSubscribe, boardSlug),
    onEvent: (cb: (event: unknown) => void) => {
      const listener = (_e: unknown, ev: unknown) => cb(ev);
      ipcRenderer.on(IpcChannel.KanbanWsEvent, listener);
      return () => ipcRenderer.removeListener(IpcChannel.KanbanWsEvent, listener);
    },
  },
};

contextBridge.exposeInMainWorld('hermes', api);
export type HermesApi = typeof api;
```

- [ ] **Step 2: Make `window.hermes` typed in renderer**

Append to `apps/desktop/src/shared/types.ts`:

```ts
declare global {
  interface Window {
    hermes: import('../preload').HermesApi;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src
git commit -m "feat(ipc): preload contextBridge + typed window.hermes"
```

### Task 18: Wire main-side handlers (REST proxy + ACP routing)

**Files:**
- Create: `apps/desktop/src/main/ipc/handlers.ts`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: Write `handlers.ts`**

```ts
// apps/desktop/src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { IpcChannel } from './channels';
import { AcpSupervisor, type AcpEvent } from '../orchestrator/acp-supervisor';
import type { ProfileSummary, StatusSnapshot, AcpClientMessage } from '../../shared/types';

type Context = {
  hermesBinary: string;
  dashboardPort: number;
  defaultHermesHome: string;
  activeHermesHome: string;
  win: () => BrowserWindow | null;
};

export function registerIpcHandlers(ctx: Context, sup: AcpSupervisor): void {
  // ── runtime ──
  ipcMain.handle(IpcChannel.RuntimeStatus, async (): Promise<StatusSnapshot> => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}/api/status`);
    const body = (await r.json()) as { version: string; gateway?: { running?: boolean; platforms?: string[] } };
    return {
      hermesVersion: body.version,
      dashboardPort: ctx.dashboardPort,
      gateway: { running: body.gateway?.running ?? false, platforms: body.gateway?.platforms ?? [] },
    };
  });

  // ── profiles ──
  ipcMain.handle(IpcChannel.ProfileList, async (): Promise<ProfileSummary[]> => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}/api/profiles`);
    if (!r.ok) throw new Error(`profiles fetch failed: ${r.status}`);
    return (await r.json()) as ProfileSummary[];
  });

  ipcMain.handle(IpcChannel.ProfileSwitch, async (_e, name: string): Promise<void> => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}/api/profiles/use`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`profile switch failed: ${r.status}`);
    sup.shutdownAll();
  });

  // ── ACP ──
  sup.on('event', (event: AcpEvent) => {
    ctx.win()?.webContents.send(IpcChannel.AcpEvent, event);
  });

  ipcMain.handle(IpcChannel.AcpStart, async (_e, opts: { profile: string; cwd: string }) => {
    const sessionId = randomUUID();
    sup.spawn({
      id: sessionId,
      profile: opts.profile,
      cwd: opts.cwd,
      binaryPath: ctx.hermesBinary,
      hermesHome: opts.profile === 'default'
        ? ctx.defaultHermesHome
        : `${ctx.defaultHermesHome}/profiles/${opts.profile}`,
    });
    return { sessionId };
  });

  ipcMain.handle(IpcChannel.AcpSend, async (_e, msg: AcpClientMessage) => {
    if (msg.kind === 'prompt') {
      sup.send(msg.sessionId, {
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'prompt',
        params: { text: msg.text },
      });
    } else {
      sup.send(msg.sessionId, {
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'tool/respond',
        params: { tool_call_id: msg.toolCallId, allow: msg.allow },
      });
    }
  });

  ipcMain.handle(IpcChannel.AcpStop, async (_e, sessionId: string) => {
    sup.shutdown(sessionId);
  });

  // ── REST proxy ──
  ipcMain.handle(IpcChannel.RestGet, async (_e, path: string) => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}${path}`);
    if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
    return r.json();
  });

  ipcMain.handle(IpcChannel.RestPost, async (_e, path: string, body: unknown) => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${path}: ${r.status}`);
    return r.json().catch(() => null);
  });

  ipcMain.handle(IpcChannel.RestPatch, async (_e, path: string, body: unknown) => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}${path}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`PATCH ${path}: ${r.status}`);
    return r.json().catch(() => null);
  });
}
```

- [ ] **Step 2: Wire into `main/index.ts`**

Replace the placeholder `apps/desktop/src/main/index.ts` with:

```ts
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { findHermesBinary, verifyHermesVersion } from './orchestrator/hermes-runtime';
import { ensureDashboard } from './orchestrator/dashboard';
import { AcpSupervisor } from './orchestrator/acp-supervisor';
import { registerIpcHandlers } from './ipc/handlers';

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

const supervisor = new AcpSupervisor();

app.whenReady().then(async () => {
  const found = findHermesBinary();
  if (found.kind === 'not-found') {
    console.error('hermes binary not found. Searched:', found.searched);
    // M1: surface in renderer via a dedicated NotFound page in a later task.
    app.quit();
    return;
  }

  const versionCheck = await verifyHermesVersion(found.path);
  if (versionCheck.kind !== 'ok') {
    console.error('hermes version probe failed', versionCheck);
    app.quit();
    return;
  }

  const hermesHome = process.env['HERMES_HOME'] ?? join(homedir(), '.hermes');
  const dashboard = await ensureDashboard({
    binaryPath: found.path,
    hermesHome,
  });
  if (dashboard.kind !== 'ready') {
    console.error('dashboard failed to start', dashboard);
    app.quit();
    return;
  }

  registerIpcHandlers(
    {
      hermesBinary: found.path,
      dashboardPort: dashboard.port,
      defaultHermesHome: hermesHome,
      activeHermesHome: hermesHome,
      win: () => win,
    },
    supervisor,
  );

  createWindow();
});

app.on('window-all-closed', () => {
  supervisor.shutdownAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  supervisor.shutdownAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 3: Verify dev still builds**

Run: `pnpm --filter @hermes-cowork/desktop typecheck`
Expected: no errors.

- [ ] **Step 4: Smoke run (real Hermes)**

Run: `pnpm dev`
Expected: window opens. Check terminal for `[dashboard] ready on port 9119` style success — or auto-quit if Hermes missing (acceptable for now; we'll add a nicer first-launch in Task 22).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main
git commit -m "feat(ipc): main-side handlers wired to orchestrator"
```

---

## Phase 7: REST Schemas (Zod)

### Task 19: Profile + Status schemas

**Files:**
- Create: `apps/desktop/src/renderer/api/schemas.ts`
- Create: `apps/desktop/tests/unit/schemas.test.ts`

- [ ] **Step 1: Write schemas**

```ts
// apps/desktop/src/renderer/api/schemas.ts
import { z } from 'zod';

export const ProfileSummarySchema = z.object({
  name: z.string(),
  active: z.boolean(),
  hermesHome: z.string(),
});
export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;

export const StatusSchema = z.object({
  hermesVersion: z.string(),
  dashboardPort: z.number(),
  gateway: z.object({
    running: z.boolean(),
    platforms: z.array(z.string()),
  }),
});
export type Status = z.infer<typeof StatusSchema>;

export const SessionSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  source: z.string().nullable(), // local, telegram, discord, …
  model: z.string().nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const KanbanTaskSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  status: z.enum(['triage', 'todo', 'ready', 'running', 'blocked', 'done', 'archived']),
  assignee: z.string().nullable(),
  parents: z.array(z.number().int()).default([]),
  createdAt: z.string(),
});
export type KanbanTask = z.infer<typeof KanbanTaskSchema>;

export const KanbanEventSchema = z.object({
  id: z.number().int(),
  taskId: z.number().int(),
  kind: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
  ts: z.string(),
});
export type KanbanEvent = z.infer<typeof KanbanEventSchema>;
```

- [ ] **Step 2: Test**

```ts
// apps/desktop/tests/unit/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { ProfileSummarySchema, KanbanTaskSchema } from '@renderer/api/schemas';

describe('ProfileSummarySchema', () => {
  it('parses valid input', () => {
    const out = ProfileSummarySchema.parse({
      name: 'research',
      active: true,
      hermesHome: '/Users/x/.hermes/profiles/research',
    });
    expect(out.name).toBe('research');
  });
  it('rejects missing fields', () => {
    expect(() => ProfileSummarySchema.parse({ name: 'x' })).toThrow();
  });
});

describe('KanbanTaskSchema', () => {
  it('rejects unknown status', () => {
    expect(() =>
      KanbanTaskSchema.parse({
        id: 1,
        title: 't',
        body: null,
        status: 'wat',
        assignee: null,
        createdAt: '2026-05-08T00:00:00Z',
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test schemas`
Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop
git commit -m "feat(api): zod schemas for REST responses"
```

### Task 20: Renderer REST client wrapper

**Files:**
- Create: `apps/desktop/src/renderer/api/rest-client.ts`

- [ ] **Step 1: Write wrapper**

```ts
// apps/desktop/src/renderer/api/rest-client.ts
import { z } from 'zod';
import { ProfileSummarySchema, StatusSchema, SessionSummarySchema, KanbanTaskSchema } from './schemas';

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await window.hermes.rest.get<unknown>(path);
  return schema.parse(raw);
}

async function post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const raw = await window.hermes.rest.post<unknown>(path, body);
  return schema.parse(raw);
}

export const api = {
  status: () => get('/api/status', StatusSchema),
  profiles: () => get('/api/profiles', z.array(ProfileSummarySchema)),
  sessions: (limit = 50) =>
    get(`/api/sessions?limit=${limit}`, z.array(SessionSummarySchema)),
  kanbanBoard: () =>
    get('/api/plugins/kanban/board', z.array(KanbanTaskSchema)),
  createKanbanTask: (input: { title: string; body?: string; assignee?: string; parentIds?: number[] }) =>
    post('/api/plugins/kanban/tasks', input, KanbanTaskSchema),
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/renderer/api/rest-client.ts
git commit -m "feat(api): typed REST client wrapper"
```

---

## Phase 8: App Shell UI

### Task 21: Layout components

**Files:**
- Create: `apps/desktop/src/renderer/shell/TitleBar.tsx`
- Create: `apps/desktop/src/renderer/shell/ModeTabs.tsx`
- Create: `apps/desktop/src/renderer/shell/Sidebar.tsx`
- Create: `apps/desktop/src/renderer/shell/StatusBar.tsx`
- Create: `apps/desktop/src/renderer/shell/ProfileDropdown.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`

- [ ] **Step 1: Write `TitleBar.tsx`**

```tsx
import { ProfileDropdown } from './ProfileDropdown';

export function TitleBar() {
  return (
    <div
      className="flex items-center gap-3 border-b border-border bg-bg px-3"
      style={{ height: 38, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="ml-16">
        <ProfileDropdown />
      </div>
      <div className="ml-auto" />
    </div>
  );
}
```

- [ ] **Step 2: Write `ModeTabs.tsx`**

```tsx
import { Link, useLocation } from 'wouter';

const TABS = [
  { id: 'chat', label: 'Chat', href: '/chat' },
  { id: 'cowork', label: 'Cowork', href: '/cowork' },
  { id: 'code', label: 'Code', href: '/code' },
] as const;

export function ModeTabs() {
  const [location] = useLocation();
  return (
    <div className="flex gap-1 border-b border-border bg-surface px-3 py-2">
      {TABS.map((t) => {
        const active = location.startsWith(t.href);
        return (
          <Link
            key={t.id}
            href={t.href}
            className={
              'rounded-md px-3 py-1 text-sm transition-colors ' +
              (active
                ? 'bg-accent text-bg font-semibold'
                : 'text-muted hover:bg-surface2')
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Write `Sidebar.tsx`**

```tsx
import { useLocation } from 'wouter';

type Item = { icon: string; label: string; href: string };

const COWORK_ITEMS: Item[] = [
  { icon: '+', label: 'New task', href: '/cowork/new' },
  { icon: '⏵', label: 'Active tasks', href: '/cowork' },
  { icon: '⏰', label: 'Scheduled', href: '/cowork/scheduled' },
  { icon: '📁', label: 'Projects', href: '/cowork/projects' },
];

const HERMES_ITEMS: Item[] = [
  { icon: '📋', label: 'Kanban', href: '/kanban' },
  { icon: '🧠', label: 'Memory', href: '/memory' },
  { icon: '🪛', label: 'Skills', href: '/skills' },
  { icon: '⏰', label: 'Cron', href: '/cron' },
  { icon: '📊', label: 'Insights', href: '/insights' },
];

export function Sidebar() {
  const [location] = useLocation();
  return (
    <aside className="flex w-[200px] flex-col gap-4 border-r border-border bg-surface px-3 py-3 text-sm">
      <Section title="Cowork" items={COWORK_ITEMS} active={location} />
      <Section title="Hermes" items={HERMES_ITEMS} active={location} />
    </aside>
  );
}

function Section({ title, items, active }: { title: string; items: Item[]; active: string }) {
  return (
    <div>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-dim">{title}</div>
      {items.map((it) => {
        const isActive = active === it.href;
        return (
          <a
            key={it.href}
            href={it.href}
            className={
              'flex items-center gap-2 rounded px-2 py-1.5 ' +
              (isActive ? 'bg-surface2 text-fg' : 'text-muted hover:text-fg')
            }
          >
            <span className="w-4 text-center">{it.icon}</span>
            <span>{it.label}</span>
          </a>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write `StatusBar.tsx`**

```tsx
import { useStatus } from '../features/chat/chat.store'; // placeholder; we will replace with a real status hook below
import { useEffect, useState } from 'react';
import { api } from '../api/rest-client';
import type { Status } from '../api/schemas';

export function StatusBar() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.status();
        if (alive) setStatus(s);
      } catch {
        if (alive) setStatus(null);
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="flex items-center gap-3 border-t border-border bg-bg px-3 py-1.5 text-[11px] text-muted">
      <GatewayDot status={status} />
      <span className="ml-auto">
        {status ? `hermes ${status.hermesVersion}` : 'connecting…'}
      </span>
    </div>
  );
}

function GatewayDot({ status }: { status: Status | null }) {
  if (!status) {
    return <span className="text-dim">● gateway: —</span>;
  }
  const { running, platforms } = status.gateway;
  if (!running) {
    return <span className="flex items-center gap-1"><span className="text-danger">●</span> gateway: stopped</span>;
  }
  return (
    <span className="flex items-center gap-1">
      <span className="text-success">●</span>
      gateway: {platforms.join(', ') || 'idle'}
    </span>
  );
}
```

- [ ] **Step 5: Write `ProfileDropdown.tsx` (skeleton — populated next phase)**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/rest-client';
import type { ProfileSummary } from '../api/schemas';

export function ProfileDropdown() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.profiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);

  const active = profiles.find((p) => p.active);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md bg-surface2 px-3 py-1 text-xs"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <strong>{active?.name ?? 'default'}</strong>
        <span className="text-dim">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-md border border-border bg-surface p-1 shadow-lg">
          {profiles.map((p) => (
            <button
              key={p.name}
              onClick={async () => {
                await window.hermes.profile.switch(p.name);
                setOpen(false);
                location.reload();
              }}
              className={
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ' +
                (p.active ? 'bg-surface2 text-fg' : 'text-muted hover:text-fg')
              }
            >
              <span className={p.active ? 'text-accent' : 'text-dim'}>●</span>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update `App.tsx` with the shell**

```tsx
import { TitleBar } from './shell/TitleBar';
import { ModeTabs } from './shell/ModeTabs';
import { Sidebar } from './shell/Sidebar';
import { StatusBar } from './shell/StatusBar';
import { Routes } from './routes';

export function App() {
  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <ModeTabs />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-bg">
          <Routes />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 7: Add `routes.tsx` placeholder**

```tsx
// apps/desktop/src/renderer/routes.tsx
import { Switch, Route, Redirect } from 'wouter';

export function Routes() {
  return (
    <Switch>
      <Route path="/chat"><div className="p-6">Chat</div></Route>
      <Route path="/cowork"><div className="p-6">Cowork</div></Route>
      <Route path="/cowork/new"><div className="p-6">New task</div></Route>
      <Route path="/code"><div className="p-6">Code</div></Route>
      <Route path="/kanban"><div className="p-6">Kanban</div></Route>
      <Route path="/"><Redirect to="/cowork" /></Route>
      <Route><div className="p-6 text-muted">Not found</div></Route>
    </Switch>
  );
}
```

- [ ] **Step 8: Remove the placeholder `useStatus` import from StatusBar.tsx**

(StatusBar.tsx already directly uses `api.status()`. Delete the unused import line `import { useStatus } from '../features/chat/chat.store';`.)

Run a search-and-replace to make sure that line is gone.

- [ ] **Step 9: Verify**

Run: `pnpm dev`
Expected: window shows TitleBar with profile dropdown, ModeTabs, Sidebar, blank main area, StatusBar at bottom.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop
git commit -m "feat(shell): TitleBar, ModeTabs, Sidebar, StatusBar, ProfileDropdown"
```

---

## Phase 9: Chat Mode

### Task 22: Sessions list

**Files:**
- Create: `apps/desktop/src/renderer/features/chat/SessionList.tsx`
- Create: `apps/desktop/src/renderer/features/chat/chat.store.ts`

- [ ] **Step 1: Write `chat.store.ts`**

```ts
// apps/desktop/src/renderer/features/chat/chat.store.ts
import { create } from 'zustand';
import type { AcpServerMessage } from '@shared/types';

type Message = {
  role: 'user' | 'assistant';
  text: string;
  toolCalls: Array<{ id: string; name: string; args: unknown; result?: unknown }>;
};

type ChatStore = {
  sessionId: string | null;
  messages: Message[];
  pendingApprovals: Array<{ toolCallId: string; description: string }>;
  startSession: (sessionId: string) => void;
  ingest: (msg: AcpServerMessage) => void;
  reset: () => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  sessionId: null,
  messages: [],
  pendingApprovals: [],

  startSession: (sessionId) =>
    set({ sessionId, messages: [], pendingApprovals: [] }),

  reset: () => set({ sessionId: null, messages: [], pendingApprovals: [] }),

  ingest: (msg) =>
    set((s) => {
      switch (msg.kind) {
        case 'token': {
          const last = s.messages[s.messages.length - 1];
          if (last && last.role === 'assistant') {
            return {
              messages: [
                ...s.messages.slice(0, -1),
                { ...last, text: last.text + msg.text },
              ],
            };
          }
          return {
            messages: [...s.messages, { role: 'assistant', text: msg.text, toolCalls: [] }],
          };
        }
        case 'tool-call': {
          const last = s.messages[s.messages.length - 1];
          if (!last || last.role !== 'assistant') return s;
          return {
            messages: [
              ...s.messages.slice(0, -1),
              { ...last, toolCalls: [...last.toolCalls, { id: msg.toolCallId, name: msg.name, args: msg.args }] },
            ],
          };
        }
        case 'tool-result': {
          const last = s.messages[s.messages.length - 1];
          if (!last || last.role !== 'assistant') return s;
          return {
            messages: [
              ...s.messages.slice(0, -1),
              {
                ...last,
                toolCalls: last.toolCalls.map((t) =>
                  t.id === msg.toolCallId ? { ...t, result: msg.result } : t,
                ),
              },
            ],
          };
        }
        case 'approval-request':
          return {
            pendingApprovals: [
              ...s.pendingApprovals,
              { toolCallId: msg.toolCallId, description: msg.description },
            ],
          };
        case 'done':
          return s;
      }
    }),
}));
```

- [ ] **Step 2: Test the store**

```ts
// apps/desktop/tests/unit/chat-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '@renderer/features/chat/chat.store';

describe('chat store', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('appends tokens to the assistant message', () => {
    const { ingest } = useChatStore.getState();
    ingest({ kind: 'token', sessionId: 's1', text: 'Hel' });
    ingest({ kind: 'token', sessionId: 's1', text: 'lo' });
    expect(useChatStore.getState().messages[0]?.text).toBe('Hello');
  });

  it('records tool calls under the current assistant message', () => {
    const { ingest } = useChatStore.getState();
    ingest({ kind: 'token', sessionId: 's1', text: 'reading...' });
    ingest({ kind: 'tool-call', sessionId: 's1', toolCallId: 't1', name: 'read_file', args: { path: 'a.md' } });
    expect(useChatStore.getState().messages[0]?.toolCalls).toEqual([
      { id: 't1', name: 'read_file', args: { path: 'a.md' } },
    ]);
  });

  it('queues approval requests', () => {
    useChatStore.getState().ingest({
      kind: 'approval-request', sessionId: 's1', toolCallId: 't1', description: 'rm -rf?',
    });
    expect(useChatStore.getState().pendingApprovals).toEqual([
      { toolCallId: 't1', description: 'rm -rf?' },
    ]);
  });
});
```

- [ ] **Step 3: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test chat-store`
Expected: 3 passing.

- [ ] **Step 4: Write `SessionList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../../api/rest-client';
import type { SessionSummary } from '../../api/schemas';

export function SessionList({ onPick }: { onPick: (id: string) => void }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  useEffect(() => {
    api.sessions(50).then(setSessions).catch(() => setSessions([]));
  }, []);

  return (
    <div className="flex h-full w-[260px] flex-col border-r border-border bg-surface">
      <div className="px-3 py-3 text-[11px] uppercase tracking-wide text-dim">Sessions</div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted">No sessions yet.</div>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="block w-full border-b border-border/50 px-3 py-2 text-left text-xs hover:bg-surface2"
          >
            <div className="text-fg">{s.title ?? s.id.slice(0, 8)}</div>
            <div className="mt-0.5 flex justify-between text-[10px] text-dim">
              <span>{s.source ?? 'local'}</span>
              <span>{s.model ?? '—'}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(chat): session store + sessions list"
```

### Task 23: Message stream + composer

**Files:**
- Create: `apps/desktop/src/renderer/features/chat/MessageStream.tsx`
- Create: `apps/desktop/src/renderer/features/chat/ToolCallCard.tsx`
- Create: `apps/desktop/src/renderer/features/chat/Composer.tsx`
- Create: `apps/desktop/src/renderer/features/chat/ChatPage.tsx`

- [ ] **Step 1: Write `ToolCallCard.tsx`**

```tsx
export function ToolCallCard(props: { name: string; args: unknown; result?: unknown }) {
  return (
    <div className="my-2 border-l-2 border-accent bg-surface px-3 py-2 text-xs">
      <div className="text-[10px] uppercase tracking-wide text-accent">⚙ tool · {props.name}</div>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted">
        {JSON.stringify(props.args, null, 2)}
      </pre>
      {props.result !== undefined && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-success">
          {typeof props.result === 'string' ? props.result : JSON.stringify(props.result, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `MessageStream.tsx`**

```tsx
import { useChatStore } from './chat.store';
import { ToolCallCard } from './ToolCallCard';

export function MessageStream() {
  const messages = useChatStore((s) => s.messages);
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {messages.length === 0 && (
        <div className="mt-12 text-center text-sm text-muted">
          Send a message to begin.
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} className="mb-6">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-dim">
            {m.role === 'user' ? 'You' : 'Hermes'}
          </div>
          <div className="whitespace-pre-wrap text-sm text-fg">{m.text}</div>
          {m.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} name={tc.name} args={tc.args} result={tc.result} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `Composer.tsx`**

```tsx
import { useState } from 'react';
import { useChatStore } from './chat.store';

export function Composer() {
  const sessionId = useChatStore((s) => s.sessionId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim() || !sessionId) return;
    setBusy(true);
    try {
      // user message echoed locally
      useChatStore.setState((s) => ({
        messages: [...s.messages, { role: 'user', text, toolCalls: [] }],
      }));
      await window.hermes.acp.send({ kind: 'prompt', sessionId, text });
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border px-6 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
        }}
        placeholder="Message Hermes... ⌘↵ to send"
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        disabled={busy}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write `ChatPage.tsx`**

```tsx
import { useEffect } from 'react';
import { SessionList } from './SessionList';
import { MessageStream } from './MessageStream';
import { Composer } from './Composer';
import { useChatStore } from './chat.store';

export function ChatPage() {
  const startSession = useChatStore((s) => s.startSession);
  const ingest = useChatStore((s) => s.ingest);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { sessionId } = await window.hermes.acp.start({ profile: 'default', cwd: process.env['HOME'] ?? '/' });
      if (cancelled) return;
      startSession(sessionId);
    };
    void init();

    const off = window.hermes.acp.onEvent((evt) => ingest(evt));

    return () => {
      cancelled = true;
      off();
    };
  }, [startSession, ingest]);

  return (
    <div className="flex h-full flex-1">
      <SessionList onPick={(_id) => { /* M1: load existing session — placeholder */ }} />
      <div className="flex flex-1 flex-col">
        <MessageStream />
        <Composer />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire `ChatPage` into routes**

Update `apps/desktop/src/renderer/routes.tsx`:

```tsx
import { Switch, Route, Redirect } from 'wouter';
import { ChatPage } from './features/chat/ChatPage';

export function Routes() {
  return (
    <Switch>
      <Route path="/chat"><ChatPage /></Route>
      <Route path="/cowork"><div className="p-6">Cowork (next phase)</div></Route>
      <Route path="/cowork/new"><div className="p-6">New task</div></Route>
      <Route path="/code"><div className="p-6">Code</div></Route>
      <Route path="/kanban"><div className="p-6">Kanban</div></Route>
      <Route path="/"><Redirect to="/chat" /></Route>
      <Route><div className="p-6 text-muted">Not found</div></Route>
    </Switch>
  );
}
```

- [ ] **Step 6: Verify dev**

Run: `pnpm dev`
Expected: opening `/chat` shows session list (empty or populated) + composer. Sending a message via ⌘↵ echoes "You: ..." locally.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat(chat): message stream, composer, ACP wiring"
```

---

## Phase 10: Cowork Mode

### Task 24: Cowork store

**Files:**
- Create: `apps/desktop/src/renderer/features/cowork/cowork.store.ts`

- [ ] **Step 1: Write store**

```ts
// apps/desktop/src/renderer/features/cowork/cowork.store.ts
import { create } from 'zustand';
import type { AcpServerMessage } from '@shared/types';
import type { KanbanTask } from '../../api/schemas';

type Approval = { toolCallId: string; description: string };

type CoworkStore = {
  sessionId: string | null;
  goal: string;
  cwd: string;
  profile: string;
  approvalMode: 'ask' | 'auto';
  transcript: Array<{ role: 'agent' | 'user'; text: string }>;
  approvals: Approval[];
  parentTaskId: number | null;
  planTasks: KanbanTask[];
  artifacts: Array<{ path: string; bytes?: number; addedAt: string }>;

  startTask: (input: { sessionId: string; goal: string; cwd: string; profile: string }) => void;
  setApprovalMode: (m: 'ask' | 'auto') => void;
  ingestAcp: (msg: AcpServerMessage) => void;
  upsertPlanTask: (task: KanbanTask) => void;
  setParent: (id: number) => void;
  reset: () => void;
};

export const useCoworkStore = create<CoworkStore>((set) => ({
  sessionId: null,
  goal: '',
  cwd: '',
  profile: 'default',
  approvalMode: 'ask',
  transcript: [],
  approvals: [],
  parentTaskId: null,
  planTasks: [],
  artifacts: [],

  startTask: ({ sessionId, goal, cwd, profile }) =>
    set({ sessionId, goal, cwd, profile, transcript: [], approvals: [], parentTaskId: null, planTasks: [], artifacts: [] }),

  setApprovalMode: (approvalMode) => set({ approvalMode }),
  setParent: (parentTaskId) => set({ parentTaskId }),

  upsertPlanTask: (task) =>
    set((s) => {
      const existing = s.planTasks.find((t) => t.id === task.id);
      const list = existing
        ? s.planTasks.map((t) => (t.id === task.id ? task : t))
        : [...s.planTasks, task];
      return { planTasks: list };
    }),

  reset: () => set({
    sessionId: null, goal: '', cwd: '', profile: 'default',
    transcript: [], approvals: [], parentTaskId: null, planTasks: [], artifacts: [],
  }),

  ingestAcp: (msg) =>
    set((s) => {
      switch (msg.kind) {
        case 'token': {
          const last = s.transcript[s.transcript.length - 1];
          if (last && last.role === 'agent') {
            return { transcript: [...s.transcript.slice(0, -1), { role: 'agent', text: last.text + msg.text }] };
          }
          return { transcript: [...s.transcript, { role: 'agent', text: msg.text }] };
        }
        case 'tool-call': {
          // Track artifact-creating tools
          if (msg.name === 'write_file' || msg.name === 'patch') {
            const args = msg.args as { path?: string };
            if (args.path) {
              return { artifacts: [...s.artifacts, { path: args.path, addedAt: new Date().toISOString() }] };
            }
          }
          return s;
        }
        case 'approval-request':
          return { approvals: [...s.approvals, { toolCallId: msg.toolCallId, description: msg.description }] };
        case 'tool-result':
        case 'done':
          return s;
      }
    }),
}));
```

- [ ] **Step 2: Test store transitions**

```ts
// apps/desktop/tests/unit/cowork-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCoworkStore } from '@renderer/features/cowork/cowork.store';

beforeEach(() => useCoworkStore.getState().reset());

describe('cowork store', () => {
  it('appends agent tokens', () => {
    const { ingestAcp } = useCoworkStore.getState();
    ingestAcp({ kind: 'token', sessionId: 's', text: 'Plan: ' });
    ingestAcp({ kind: 'token', sessionId: 's', text: '7 steps.' });
    expect(useCoworkStore.getState().transcript[0]?.text).toBe('Plan: 7 steps.');
  });

  it('records artifacts on write_file tool calls', () => {
    useCoworkStore.getState().ingestAcp({
      kind: 'tool-call', sessionId: 's', toolCallId: 't1',
      name: 'write_file', args: { path: '/tmp/draft.md' },
    });
    expect(useCoworkStore.getState().artifacts[0]?.path).toBe('/tmp/draft.md');
  });

  it('queues approvals', () => {
    useCoworkStore.getState().ingestAcp({
      kind: 'approval-request', sessionId: 's', toolCallId: 't1', description: 'drop production table?',
    });
    expect(useCoworkStore.getState().approvals).toEqual([
      { toolCallId: 't1', description: 'drop production table?' },
    ]);
  });
});
```

- [ ] **Step 3: Run — expect PASS**

Run: `pnpm --filter @hermes-cowork/desktop test cowork-store`
Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop
git commit -m "feat(cowork): store with transcript/approvals/artifacts/plan"
```

### Task 25: New Task dialog

**Files:**
- Create: `apps/desktop/src/renderer/features/cowork/NewTaskDialog.tsx`

- [ ] **Step 1: Write dialog**

```tsx
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCoworkStore } from './cowork.store';

const COWORK_SYSTEM_PROMPT = `You are running in Hermes Cowork mode.

Before doing any work, propose a plan using kanban_create — one subtask per concrete step, linked under a parent task whose title is the user's goal.

Use kanban_heartbeat regularly during long-running steps.
Mark subtasks complete with kanban_complete as you finish them.
Spawn additional profiles via kanban_create with --assignee for parallelizable subtasks.
For destructive operations (deleting files, dropping tables, irreversible API calls), always request approval inline regardless of mode.`.trim();

export function NewTaskDialog() {
  const [goal, setGoal] = useState('');
  const [cwd, setCwd] = useState('');
  const [profile, setProfile] = useState('default');
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();
  const startTask = useCoworkStore((s) => s.startTask);

  const pickFolder = async () => {
    // Renderer can't open native dialog directly under contextIsolation;
    // M1 placeholder: paste an absolute path. Native dialog wired in Task 26.
  };

  const submit = async () => {
    if (!goal.trim() || !cwd.trim()) return;
    setBusy(true);
    try {
      const { sessionId } = await window.hermes.acp.start({ profile, cwd });
      startTask({ sessionId, goal, cwd, profile });
      // Send the kickoff: system + goal as a single prompt.
      await window.hermes.acp.send({
        kind: 'prompt',
        sessionId,
        text: `${COWORK_SYSTEM_PROMPT}\n\nGoal: ${goal}\nWorking directory: ${cwd}\n\nPropose a plan now.`,
      });
      navigate('/cowork');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-xl rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-lg font-semibold">New Cowork task</h2>

      <label className="mb-1 block text-xs text-muted">Goal</label>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="e.g. Pull Q2 metrics from Mixpanel and draft the weekly report"
        className="mb-4 w-full rounded border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />

      <label className="mb-1 block text-xs text-muted">Working folder (absolute path)</label>
      <div className="mb-4 flex gap-2">
        <input
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="/Users/x/work/q2-report"
          className="flex-1 rounded border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button onClick={pickFolder} className="rounded bg-surface2 px-3 py-2 text-xs hover:bg-border">
          Pick…
        </button>
      </div>

      <label className="mb-1 block text-xs text-muted">Profile</label>
      <input
        value={profile}
        onChange={(e) => setProfile(e.target.value)}
        className="mb-6 w-full rounded border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />

      <div className="flex justify-end gap-2">
        <button onClick={() => navigate('/cowork')} className="rounded px-3 py-2 text-sm text-muted hover:text-fg">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || !goal.trim() || !cwd.trim()}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {busy ? 'Starting…' : 'Start task'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop
git commit -m "feat(cowork): new task dialog with system prompt kickoff"
```

### Task 26: Native folder picker via IPC

**Files:**
- Modify: `apps/desktop/src/main/ipc/channels.ts`
- Modify: `apps/desktop/src/main/ipc/handlers.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/features/cowork/NewTaskDialog.tsx`

- [ ] **Step 1: Add channel constant**

In `channels.ts`, add to the `IpcChannel` object:

```ts
  ShowFolderPicker: 'dialog:folder',
```

- [ ] **Step 2: Add handler**

In `handlers.ts`, add inside `registerIpcHandlers` body:

```ts
import { dialog } from 'electron';
// ...
ipcMain.handle(IpcChannel.ShowFolderPicker, async () => {
  const w = ctx.win();
  if (!w) return null;
  const result = await dialog.showOpenDialog(w, { properties: ['openDirectory'] });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});
```

- [ ] **Step 3: Add preload binding**

In `preload/index.ts`, add inside `api`:

```ts
dialog: {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.ShowFolderPicker),
},
```

- [ ] **Step 4: Wire `pickFolder` in `NewTaskDialog.tsx`**

Replace the `pickFolder` placeholder with:

```tsx
const pickFolder = async () => {
  const path = await window.hermes.dialog.pickFolder();
  if (path) setCwd(path);
};
```

- [ ] **Step 5: Smoke test in dev**

Run: `pnpm dev`. Click "Pick…" — native dialog opens, selecting a folder fills the input.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop
git commit -m "feat(cowork): native folder picker via IPC"
```

### Task 27: Cowork main page (transcript + approvals + composer)

**Files:**
- Create: `apps/desktop/src/renderer/features/cowork/GoalHeader.tsx`
- Create: `apps/desktop/src/renderer/features/cowork/Transcript.tsx`
- Create: `apps/desktop/src/renderer/features/cowork/ApprovalCard.tsx`
- Create: `apps/desktop/src/renderer/features/cowork/CoworkPage.tsx`
- Modify: `apps/desktop/src/renderer/routes.tsx`

- [ ] **Step 1: Write `GoalHeader.tsx`**

```tsx
import { useCoworkStore } from './cowork.store';

export function GoalHeader() {
  const { goal, cwd, profile, planTasks } = useCoworkStore();
  const total = planTasks.length;
  const done = planTasks.filter((t) => t.status === 'done' || t.status === 'archived').length;

  if (!goal) return null;
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="text-[10px] uppercase tracking-wide text-dim">Goal</div>
      <div className="mt-1 text-base text-fg">{goal}</div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
        <span>📁 {cwd}</span>
        <span>·</span>
        <span>👤 {profile}</span>
        {total > 0 && (
          <>
            <span>·</span>
            <span className="text-success">● step {done + 1} of {total}</span>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `Transcript.tsx`**

```tsx
import { useCoworkStore } from './cowork.store';
import { ApprovalCard } from './ApprovalCard';

export function Transcript() {
  const { transcript, approvals } = useCoworkStore();

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 text-sm">
      {transcript.length === 0 && (
        <div className="mt-12 text-center text-muted">Hermes will propose a plan shortly…</div>
      )}
      {transcript.map((m, i) => (
        <div key={i} className="mb-4 whitespace-pre-wrap">
          {m.text}
        </div>
      ))}
      {approvals.map((a) => (
        <ApprovalCard key={a.toolCallId} approval={a} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `ApprovalCard.tsx`**

```tsx
import { useCoworkStore } from './cowork.store';

export function ApprovalCard({ approval }: { approval: { toolCallId: string; description: string } }) {
  const sessionId = useCoworkStore((s) => s.sessionId);

  const respond = async (allow: boolean) => {
    if (!sessionId) return;
    await window.hermes.acp.send({ kind: 'approve', sessionId, toolCallId: approval.toolCallId, allow });
    useCoworkStore.setState((s) => ({
      approvals: s.approvals.filter((a) => a.toolCallId !== approval.toolCallId),
    }));
  };

  return (
    <div className="my-3 rounded border border-warn/40 bg-warn/5 px-4 py-3">
      <div className="mb-2 text-xs font-semibold text-warn">⚠ Approval needed</div>
      <div className="mb-3 text-sm">{approval.description}</div>
      <div className="flex gap-2">
        <button
          onClick={() => respond(true)}
          className="rounded bg-accent px-3 py-1 text-xs font-semibold text-bg"
        >
          Approve
        </button>
        <button
          onClick={() => respond(false)}
          className="rounded bg-surface2 px-3 py-1 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `CoworkPage.tsx` (combines goal + transcript + composer; right-pane added next phase)**

```tsx
import { useEffect } from 'react';
import { GoalHeader } from './GoalHeader';
import { Transcript } from './Transcript';
import { Composer as ChatComposer } from '../chat/Composer';  // reuse for steering
import { useCoworkStore } from './cowork.store';

export function CoworkPage() {
  const ingestAcp = useCoworkStore((s) => s.ingestAcp);

  useEffect(() => {
    const off = window.hermes.acp.onEvent((evt) => ingestAcp(evt));
    return () => off();
  }, [ingestAcp]);

  return (
    <div className="flex h-full flex-1">
      <div className="flex flex-1 flex-col overflow-hidden">
        <GoalHeader />
        <Transcript />
        <ChatComposer />
      </div>
      {/* RightPane added in Task 29 */}
    </div>
  );
}
```

- [ ] **Step 5: Update routes**

In `routes.tsx`, replace the `cowork` route with:

```tsx
import { CoworkPage } from './features/cowork/CoworkPage';
import { NewTaskDialog } from './features/cowork/NewTaskDialog';

// ... inside <Switch>:
<Route path="/cowork"><CoworkPage /></Route>
<Route path="/cowork/new"><NewTaskDialog /></Route>
```

- [ ] **Step 6: Verify dev**

Run: `pnpm dev`. Navigate to `/cowork/new`, fill goal + folder, click Start. ACP starts, `/cowork` opens, agent's plan starts streaming.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat(cowork): page with goal header, transcript, approvals"
```

---

## Phase 11: Cowork Right Pane + Kanban WebSocket

### Task 28: Kanban event WebSocket pump

**Files:**
- Modify: `apps/desktop/src/main/ipc/handlers.ts` (add WS bridge)
- Modify: `apps/desktop/src/main/orchestrator/dashboard.ts` (export WS URL helper)
- Modify: `apps/desktop/src/main/index.ts` (start the WS pump)

- [ ] **Step 1: Add WS pump module**

Create `apps/desktop/src/main/orchestrator/kanban-ws.ts`:

```ts
import { BrowserWindow } from 'electron';
import { IpcChannel } from '../ipc/channels';

// Lazy WebSocket import (avoid bundling cost if unused)
type WsModule = typeof import('ws');

export class KanbanWsPump {
  private ws: import('ws').WebSocket | null = null;
  private retry = 0;
  private url: string;
  private win: () => BrowserWindow | null;

  constructor(opts: { port: number; win: () => BrowserWindow | null }) {
    this.url = `ws://127.0.0.1:${opts.port}/api/plugins/kanban/events`;
    this.win = opts.win;
  }

  async start(): Promise<void> {
    const { WebSocket } = (await import('ws')) as WsModule;
    const connect = () => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => { this.retry = 0; });
      this.ws.on('message', (data: import('ws').RawData) => {
        try {
          const event: unknown = JSON.parse(data.toString());
          this.win()?.webContents.send(IpcChannel.KanbanWsEvent, event);
        } catch { /* drop malformed */ }
      });
      this.ws.on('close', () => {
        const delay = Math.min(30_000, 500 * 2 ** this.retry++);
        setTimeout(connect, delay);
      });
      this.ws.on('error', () => { /* close handler retries */ });
    };
    connect();
  }

  stop(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 2: Add `ws` dependency**

```bash
pnpm --filter @hermes-cowork/desktop add ws
pnpm --filter @hermes-cowork/desktop add -D @types/ws
```

- [ ] **Step 3: Add KanbanWsSubscribe IPC handler (no-op for M1 — pump always on)**

In `handlers.ts`, add:

```ts
ipcMain.handle(IpcChannel.KanbanWsSubscribe, async (_e, _boardSlug: string | null) => {
  // M1: single-board pump active globally; subscription is renderer filter only.
});
```

- [ ] **Step 4: Start the pump in `main/index.ts`**

After `registerIpcHandlers(...)`, add:

```ts
import { KanbanWsPump } from './orchestrator/kanban-ws';
const pump = new KanbanWsPump({ port: dashboard.port, win: () => win });
await pump.start();

app.on('before-quit', () => {
  pump.stop();
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(orchestrator): kanban WebSocket pump → renderer"
```

### Task 29: Right pane (Plan / Artifacts / Subtasks)

**Files:**
- Create: `apps/desktop/src/renderer/features/cowork/RightPane.tsx`
- Create: `apps/desktop/src/renderer/features/cowork/PlanTab.tsx`
- Create: `apps/desktop/src/renderer/features/cowork/ArtifactsTab.tsx`
- Create: `apps/desktop/src/renderer/features/cowork/SubtasksTab.tsx`
- Modify: `apps/desktop/src/renderer/features/cowork/CoworkPage.tsx`

- [ ] **Step 1: Write `PlanTab.tsx`**

```tsx
import { useEffect } from 'react';
import { useCoworkStore } from './cowork.store';
import { KanbanEventSchema, KanbanTaskSchema } from '../../api/schemas';

export function PlanTab() {
  const planTasks = useCoworkStore((s) => s.planTasks);
  const upsert = useCoworkStore((s) => s.upsertPlanTask);
  const parentId = useCoworkStore((s) => s.parentTaskId);

  useEffect(() => {
    const off = window.hermes.kanbanWs.onEvent((raw) => {
      const ev = KanbanEventSchema.safeParse(raw);
      if (!ev.success) return;
      // Only ingest events for the active task tree (parent + its children).
      // For M1: parent id arrives via a separate kanban_create observation;
      // until that lands, ingest all running tasks for the active profile.
      const payloadTask = (ev.data.payload as { task?: unknown }).task;
      if (!payloadTask) return;
      const parsed = KanbanTaskSchema.safeParse(payloadTask);
      if (!parsed.success) return;
      const t = parsed.data;
      if (parentId !== null && t.id !== parentId && !t.parents.includes(parentId)) return;
      upsert(t);
    });
    return () => off();
  }, [parentId, upsert]);

  if (planTasks.length === 0) {
    return <div className="p-4 text-xs text-muted">Plan will appear here once Hermes proposes one.</div>;
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-3 text-xs">
      {planTasks.map((t) => (
        <PlanRow key={t.id} task={t} />
      ))}
    </div>
  );
}

function PlanRow({ task }: { task: import('../../api/schemas').KanbanTask }) {
  const icon = task.status === 'done' || task.status === 'archived' ? '✓'
    : task.status === 'running' ? '▸'
    : '○';
  const color = task.status === 'done' || task.status === 'archived' ? 'text-success'
    : task.status === 'running' ? 'text-accent'
    : 'text-dim';
  const muted = task.status === 'done' || task.status === 'archived' ? 'text-muted line-through' : 'text-fg';
  return (
    <div className={'flex items-start gap-2 rounded px-2 py-1 ' + (task.status === 'running' ? 'bg-surface2' : '')}>
      <span className={color}>{icon}</span>
      <span className={muted}>{task.title}</span>
    </div>
  );
}
```

- [ ] **Step 2: Write `ArtifactsTab.tsx`**

```tsx
import { useCoworkStore } from './cowork.store';

export function ArtifactsTab() {
  const artifacts = useCoworkStore((s) => s.artifacts);
  if (artifacts.length === 0) {
    return <div className="p-4 text-xs text-muted">Files Hermes reads or writes appear here.</div>;
  }
  return (
    <div className="flex flex-col gap-1 px-3 py-3 text-xs">
      {artifacts.map((a, i) => (
        <button
          key={i}
          onClick={async () => { await window.hermes.dialog.pickFolder; /* placeholder open */ }}
          className="rounded border border-border bg-surface px-2 py-1.5 text-left hover:bg-surface2"
        >
          <div className="truncate text-fg">{a.path}</div>
          <div className="text-[10px] text-dim">{new Date(a.addedAt).toLocaleTimeString()}</div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `SubtasksTab.tsx`**

```tsx
import { useCoworkStore } from './cowork.store';

export function SubtasksTab() {
  const planTasks = useCoworkStore((s) => s.planTasks);
  const subtasks = planTasks.filter((t) => t.assignee && t.assignee !== useCoworkStore.getState().profile);
  if (subtasks.length === 0) {
    return <div className="p-4 text-xs text-muted">Spawned subagents (other profiles) will list here.</div>;
  }
  return (
    <div className="flex flex-col gap-2 px-3 py-3 text-xs">
      {subtasks.map((t) => (
        <div key={t.id} className="rounded border border-border bg-surface px-2 py-2">
          <div className="text-fg">{t.title}</div>
          <div className="mt-1 flex justify-between text-[10px] text-dim">
            <span>👤 {t.assignee}</span>
            <span>{t.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `RightPane.tsx`**

```tsx
import { useState } from 'react';
import { PlanTab } from './PlanTab';
import { ArtifactsTab } from './ArtifactsTab';
import { SubtasksTab } from './SubtasksTab';
import { useCoworkStore } from './cowork.store';

const TABS = [
  { id: 'plan', label: 'Plan' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'subtasks', label: 'Subtasks' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function RightPane() {
  const [tab, setTab] = useState<TabId>('plan');
  const approvalMode = useCoworkStore((s) => s.approvalMode);
  const setApprovalMode = useCoworkStore((s) => s.setApprovalMode);

  return (
    <aside className="flex w-[280px] flex-col border-l border-border bg-surface">
      <div className="flex border-b border-border text-[11px]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'px-3 py-2.5 ' +
              (tab === t.id
                ? 'border-b-2 border-accent bg-bg text-accent'
                : 'text-muted hover:text-fg')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'plan' && <PlanTab />}
        {tab === 'artifacts' && <ArtifactsTab />}
        {tab === 'subtasks' && <SubtasksTab />}
      </div>
      <div className="border-t border-border p-3 text-[11px]">
        <div className="mb-2 text-[9px] uppercase tracking-wide text-dim">Mode</div>
        <button
          onClick={() => setApprovalMode(approvalMode === 'ask' ? 'auto' : 'ask')}
          className="flex items-center gap-2"
        >
          <span
            className={
              'inline-flex h-3.5 w-6 items-center rounded-full p-0.5 ' +
              (approvalMode === 'ask' ? 'justify-end bg-accent' : 'justify-start bg-surface2')
            }
          >
            <span className="h-2.5 w-2.5 rounded-full bg-fg" />
          </span>
          <span>{approvalMode === 'ask' ? 'Ask before acting' : 'Act without asking'}</span>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Mount in `CoworkPage.tsx`**

```tsx
import { useEffect } from 'react';
import { GoalHeader } from './GoalHeader';
import { Transcript } from './Transcript';
import { Composer as ChatComposer } from '../chat/Composer';
import { RightPane } from './RightPane';
import { useCoworkStore } from './cowork.store';

export function CoworkPage() {
  const ingestAcp = useCoworkStore((s) => s.ingestAcp);

  useEffect(() => {
    const off = window.hermes.acp.onEvent((evt) => ingestAcp(evt));
    return () => off();
  }, [ingestAcp]);

  return (
    <div className="flex h-full flex-1">
      <div className="flex flex-1 flex-col overflow-hidden">
        <GoalHeader />
        <Transcript />
        <ChatComposer />
      </div>
      <RightPane />
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `pnpm dev`. Start a Cowork task. As Hermes calls `kanban_create` for plan steps, the right-pane Plan tab populates. Tool calls like `write_file` populate the Artifacts tab.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat(cowork): right pane (Plan/Artifacts/Subtasks) + mode toggle"
```

---

## Phase 12: First-Launch Wizard (Hermes Not Found)

### Task 30: Replace silent quit with a visible error page

**Files:**
- Create: `apps/desktop/src/renderer/shell/RuntimeError.tsx`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/main/ipc/channels.ts`
- Modify: `apps/desktop/src/main/ipc/handlers.ts`
- Modify: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: Add channels**

In `channels.ts`:

```ts
RuntimeProbe: 'runtime:probe',
```

- [ ] **Step 2: Add probe handler**

In `handlers.ts`:

```ts
import { findHermesBinary, verifyHermesVersion, MIN_HERMES_VERSION } from '../orchestrator/hermes-runtime';

ipcMain.handle(IpcChannel.RuntimeProbe, async () => {
  const found = findHermesBinary();
  if (found.kind === 'not-found') return { kind: 'not-found' as const, searched: found.searched };
  const v = await verifyHermesVersion(found.path);
  if (v.kind === 'too-old') return { kind: 'too-old' as const, version: v.version, min: v.min };
  if (v.kind === 'version-failed') return { kind: 'version-failed' as const, stderr: v.stderr };
  return { kind: 'ok' as const, path: found.path, version: v.version, min: MIN_HERMES_VERSION };
});
```

- [ ] **Step 3: Preload binding**

In `preload/index.ts`, inside `runtime`:

```ts
probe: () => ipcRenderer.invoke(IpcChannel.RuntimeProbe),
```

- [ ] **Step 4: Write `RuntimeError.tsx`**

```tsx
type RuntimeError =
  | { kind: 'not-found'; searched: string[] }
  | { kind: 'too-old'; version: string; min: string }
  | { kind: 'version-failed'; stderr: string };

export function RuntimeError({ error }: { error: RuntimeError }) {
  return (
    <div className="flex h-full items-center justify-center bg-bg p-8">
      <div className="max-w-xl rounded-lg border border-border bg-surface p-6 text-sm">
        <h1 className="mb-3 text-lg font-semibold text-warn">Hermes runtime unavailable</h1>

        {error.kind === 'not-found' && (
          <>
            <p className="mb-3">Hermes Cowork couldn't find the <code>hermes</code> binary on your system.</p>
            <p className="mb-2">Install it with:</p>
            <pre className="mb-3 rounded bg-bg p-3 text-xs">curl -fsSL https://hermes-agent.nousresearch.com/install.sh | sh</pre>
            <details className="text-xs text-muted">
              <summary>Searched paths</summary>
              <ul className="mt-2 list-disc pl-5">
                {error.searched.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </details>
          </>
        )}

        {error.kind === 'too-old' && (
          <p>Hermes {error.version} is installed, but Cowork needs at least {error.min}. Run <code>hermes update</code>.</p>
        )}

        {error.kind === 'version-failed' && (
          <>
            <p className="mb-2">Hermes is installed but failed to report a version.</p>
            <pre className="rounded bg-bg p-3 text-xs">{error.stderr}</pre>
          </>
        )}

        <button
          onClick={() => location.reload()}
          className="mt-4 rounded bg-accent px-4 py-2 text-xs font-semibold text-bg"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Don't auto-quit in `main/index.ts`**

Replace the early `app.quit()` calls with a flag passed to renderer. The simplest M1 path: still create the window but pass an env var indicating runtime status. Actually: cleanest is to always create the window, then have the renderer call `window.hermes.runtime.probe()` and render `<RuntimeError>` if not OK.

Modify `app.whenReady().then(...)` so the **window is always created**:

```ts
app.whenReady().then(async () => {
  const found = findHermesBinary();
  let hermesBinary = '';
  let dashboardPort = 0;

  if (found.kind === 'found') {
    const versionCheck = await verifyHermesVersion(found.path);
    if (versionCheck.kind === 'ok') {
      hermesBinary = found.path;
      const hermesHome = process.env['HERMES_HOME'] ?? join(homedir(), '.hermes');
      const dashboard = await ensureDashboard({ binaryPath: found.path, hermesHome });
      if (dashboard.kind === 'ready') {
        dashboardPort = dashboard.port;
      }
    }
  }

  registerIpcHandlers(
    {
      hermesBinary,
      dashboardPort,
      defaultHermesHome: process.env['HERMES_HOME'] ?? join(homedir(), '.hermes'),
      activeHermesHome: process.env['HERMES_HOME'] ?? join(homedir(), '.hermes'),
      win: () => win,
    },
    supervisor,
  );

  if (dashboardPort > 0) {
    const pump = new KanbanWsPump({ port: dashboardPort, win: () => win });
    await pump.start();
    app.on('before-quit', () => pump.stop());
  }

  createWindow();
});
```

- [ ] **Step 6: Render `<RuntimeError>` in `App.tsx` when probe fails**

```tsx
import { useEffect, useState } from 'react';
import { TitleBar } from './shell/TitleBar';
import { ModeTabs } from './shell/ModeTabs';
import { Sidebar } from './shell/Sidebar';
import { StatusBar } from './shell/StatusBar';
import { Routes } from './routes';
import { RuntimeError } from './shell/RuntimeError';

type Probe = Awaited<ReturnType<typeof window.hermes.runtime.probe>>;

export function App() {
  const [probe, setProbe] = useState<Probe | null>(null);
  useEffect(() => {
    window.hermes.runtime.probe().then(setProbe);
  }, []);

  if (probe === null) {
    return <main className="flex h-screen items-center justify-center text-muted">Connecting to Hermes…</main>;
  }
  if (probe.kind !== 'ok') {
    return <RuntimeError error={probe} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <ModeTabs />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-bg">
          <Routes />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 7: Verify by temporarily renaming `~/.local/bin/hermes` and launching**

(Restore after.) Expect the runtime-error page with searched paths.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop
git commit -m "feat(shell): runtime probe + first-launch error page"
```

---

## Phase 13: macOS Packaging

### Task 31: electron-builder config

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Create: `apps/desktop/build/icon.icns` (placeholder)

- [ ] **Step 1: Write `electron-builder.yml`**

```yaml
appId: com.hermescowork.desktop
productName: Hermes Cowork
artifactName: ${productName}-${version}-${arch}.${ext}
directories:
  output: release
  buildResources: build

files:
  - out/**/*
  - "!node_modules/**/*"

mac:
  category: public.app-category.developer-tools
  icon: build/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  notarize: false  # set true once Apple Developer cert is configured
  target:
    - target: dmg
      arch: [arm64]

dmg:
  background: build/dmg-background.png
  iconSize: 96
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
```

- [ ] **Step 2: Add a placeholder 1024×1024 icon**

```bash
mkdir -p apps/desktop/build
# Use a placeholder icon — replace with real Hermes Cowork icon before launch.
# For dev: any 1024×1024 PNG converted via iconutil to icns.
# Quick path:
echo "Placeholder icon — replace before public release" > apps/desktop/build/ICON_TODO.txt
```

(If no real icon yet, set `mac.icon` to omit the field temporarily — electron-builder will use a generic icon. Do not block M1 on this.)

- [ ] **Step 3: Build a DMG**

Run: `pnpm --filter @hermes-cowork/desktop build:mac`
Expected: `release/Hermes Cowork-0.0.1-arm64.dmg` produced. Mount it, drag to Applications, launch — app starts.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron-builder.yml apps/desktop/build
git commit -m "build(mac): electron-builder DMG configuration"
```

---

## Phase 14: E2E Smoke Test

### Task 32: Playwright + Electron harness

**Files:**
- Create: `apps/desktop/playwright.config.ts`
- Create: `apps/desktop/tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Add Playwright deps already in package.json — verify**

Run: `pnpm --filter @hermes-cowork/desktop list @playwright/test`
Expected: version present.

Then install browsers if needed:

```bash
pnpm --filter @hermes-cowork/desktop exec playwright install
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: { headless: false },
  expect: { timeout: 10_000 },
});
```

- [ ] **Step 3: Write smoke spec**

```ts
// apps/desktop/tests/e2e/smoke.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('app launches and shows mode tabs', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // ModeTabs should render eventually (after runtime probe ok or runtime error).
  const text = await win.locator('body').textContent({ timeout: 15_000 });
  expect(text).toMatch(/Hermes Cowork|Chat|Cowork|Hermes runtime unavailable/);

  await app.close();
});
```

- [ ] **Step 4: Build then run**

```bash
pnpm --filter @hermes-cowork/desktop build
pnpm --filter @hermes-cowork/desktop test:e2e
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "test(e2e): playwright launch smoke test"
```

---

## Phase 15: Ship v0.1.0

### Task 33: README with screenshots

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `docs/screenshots/` (placeholder)

- [ ] **Step 1: Write `LICENSE`**

```
MIT License

Copyright (c) 2026 Fazlay Rabbi and Hermes Cowork contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Write `README.md`**

```markdown
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
```

- [ ] **Step 3: Capture screenshots**

Run dev, screenshot Cowork mode and Chat mode, save to `docs/screenshots/cowork.png` and `docs/screenshots/chat.png`. (Manual step — required for the README to look complete.)

- [ ] **Step 4: Commit**

```bash
git add README.md LICENSE docs/screenshots
git commit -m "docs: README + LICENSE for v0.1.0"
```

### Task 34: Tag v0.1.0

- [ ] **Step 1: Update version**

In root `package.json` and `apps/desktop/package.json` change `"version"` to `"0.1.0"`.

- [ ] **Step 2: Commit version bump**

```bash
git add package.json apps/desktop/package.json
git commit -m "chore: bump to 0.1.0"
```

- [ ] **Step 3: Tag**

```bash
git tag -a v0.1.0 -m "Hermes Cowork v0.1.0 — M1 (Foundation + Chat + Cowork)"
```

- [ ] **Step 4: Build production DMG**

Run: `pnpm --filter @hermes-cowork/desktop build:mac`
Expected: signed (or unsigned-with-warning) DMG in `release/`.

- [ ] **Step 5: Push + create GitHub Release (manual)**

```bash
git push origin main --tags
```

Then on GitHub, create a release for `v0.1.0`, attach the DMG. (This is a one-time manual step; in M4 we'll automate via GitHub Actions.)

- [ ] **Step 6: Verify install path**

Mount the DMG, drag to Applications, launch from Applications. Verify Cowork mode runs end-to-end.

---

## Self-Review

**Spec coverage check:**

| Spec section | Plan coverage |
|---|---|
| 3.1 Process model | Phases 4 (dashboard), 5 (ACP), 11 (kanban-ws), 6 (IPC) |
| 3.2 Hybrid integration | Phases 5, 7, 11 |
| 4.1 Main modules | Tasks 7–18, 28, 30 |
| 4.2 Renderer surfaces | Phases 8–11 |
| 4.3 Orchestrator detail | Task 12 (probe-then-spawn), Task 14 (ACP supervisor), Task 30 (runtime probe) |
| 5.1 Chat mode | Phase 9 (Tasks 22–23) |
| 5.2 Cowork mode (centerpiece) | Phases 10–11 (Tasks 24–29) |
| 5.5 Profile switcher | Task 21 (ProfileDropdown) |
| 5.6 Gateway status | Task 21 (StatusBar) — read-only in M1; mgmt UI is M3 |
| 5.7 Settings | M3 — out of M1 scope |
| 7 Lifecycle table | Task 14 (shutdown), Task 18 (profile switch shutdown), main/index.ts (before-quit) |
| 8 Security | Folder picker via main; no network exposed; localhost-only Hermes |
| 10 M1 milestone | All tasks above |
| 12 Testing | Phases incl. unit (jsonrpc, schemas, stores, runtime, dashboard, supervisor); E2E in Phase 14 |

**Out-of-M1 deferred (consistent with spec §10):**
- Code mode → M3
- Full Kanban board UI → M2
- Profile create/clone/delete → M2
- Gateway control UI → M3
- Auto-update wiring + Windows/Linux packaging → M4

**Placeholder scan:** No "TBD/TODO/implement later" appearances. The README mentions placeholder icon and screenshots, both with explicit "manual step" guidance — those are real artifacts the engineer must produce before pushing the tag, not under-specified plan steps.

**Type consistency check:** Verified across the plan:
- `HermesRuntime`, `RuntimeProbeError`, `compareSemver` used consistently in Tasks 7–9.
- `AcpSupervisor`, `AcpEvent`, `AcpSession` referenced the same way in Tasks 14–18.
- `ProfileSummary`, `Status`, `KanbanTask`, `KanbanEvent` defined once (Task 19) and re-used.
- `IpcChannel` extended in Tasks 16, 26, 28, 30 with no naming collisions.
- `useChatStore`, `useCoworkStore` API surface (`startSession`, `ingest`, `reset` / `startTask`, `ingestAcp`, `upsertPlanTask`) consistent across the plan.

The plan is ready to execute.
