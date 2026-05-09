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

void app.whenReady().then(async () => {
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
