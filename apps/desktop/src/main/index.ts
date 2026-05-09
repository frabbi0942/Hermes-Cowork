import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { findHermesBinary, verifyHermesVersion } from './orchestrator/hermes-runtime';
import { ensureDashboard, fetchDashboardToken } from './orchestrator/dashboard';
import { AcpSupervisor } from './orchestrator/acp-supervisor';
import { registerIpcHandlers } from './ipc/handlers';
import { KanbanWsPump } from './orchestrator/kanban-ws';

let win: BrowserWindow | null = null;
let pump: KanbanWsPump | null = null;

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
  let hermesBinary = '';
  let dashboardPort = 0;
  let dashboardToken: string | null = null;

  if (found.kind === 'found') {
    const versionCheck = await verifyHermesVersion(found.path);
    if (versionCheck.kind === 'ok') {
      hermesBinary = found.path;
      const hermesHome = process.env['HERMES_HOME'] ?? join(homedir(), '.hermes');
      const dashboard = await ensureDashboard({ binaryPath: found.path, hermesHome });
      if (dashboard.kind === 'ready') {
        dashboardPort = dashboard.port;
        dashboardToken = await fetchDashboardToken(dashboard.port);
      }
    }
  }

  registerIpcHandlers(
    {
      hermesBinary,
      dashboardPort,
      dashboardToken,
      defaultHermesHome: process.env['HERMES_HOME'] ?? join(homedir(), '.hermes'),
      activeHermesHome: process.env['HERMES_HOME'] ?? join(homedir(), '.hermes'),
      win: () => win,
    },
    supervisor,
  );

  if (dashboardPort > 0) {
    pump = new KanbanWsPump({ port: dashboardPort, win: () => win });
    await pump.start();
  }

  createWindow();
});

app.on('window-all-closed', () => {
  supervisor.shutdownAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  pump?.stop();
  supervisor.shutdownAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
