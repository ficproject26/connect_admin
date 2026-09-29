'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const url = require('url');

// ─── Environment Detection ────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL || 'http://localhost:5173';

// ─── Keep global window reference (prevent GC) ───────────────────────────────
let mainWindow = null;

// ─── Preload script path ──────────────────────────────────────────────────────
const PRELOAD_PATH = path.join(__dirname, 'preload.js');

// ─── App resource root (works for both dev and packaged) ─────────────────────
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');

// ─── Local production server (serve built frontend/dist) ─────────────────────
let localServer = null;
let localPort = 3939;

async function startLocalServer() {
  if (isDev) return null;

  const http = require('http');
  const fs = require('fs');
  const mime = require('mime-types');

  const distDir = path.join(APP_ROOT, 'frontend', 'dist');

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);

      // Strip query strings
      filePath = filePath.split('?')[0];

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        // SPA fallback – serve index.html for all unknown routes
        filePath = path.join(distDir, 'index.html');
      }

      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    });

    server.listen(localPort, '127.0.0.1', () => {
      console.log(`[Electron] Local production server running at http://127.0.0.1:${localPort}`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        localPort++;
        server.close();
        resolve(startLocalServer()); // retry with next port
      } else {
        reject(err);
      }
    });
  });
}

// ─── Window creation ──────────────────────────────────────────────────────────
async function createWindow() {
  // Start local server in production
  if (!isDev) {
    try {
      localServer = await startLocalServer();
    } catch (err) {
      console.error('[Electron] Failed to start local server:', err);
    }
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false, // show after ready-to-show to avoid flash
    backgroundColor: '#0f172a',
    icon: path.join(APP_ROOT, 'frontend', 'public', 'logo.jpg'),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Connect App Admin',
  });

  // ── Load the app URL ────────────────────────────────────────────────────────
  const loadURL = isDev
    ? DEV_SERVER_URL
    : `http://127.0.0.1:${localPort}`;

  // Wait for Vite dev server in dev mode
  if (isDev) {
    await waitForDevServer(DEV_SERVER_URL);
  }

  mainWindow.loadURL(loadURL).catch((err) => {
    console.error('[Electron] Failed to load URL:', err);
  });

  // ── Window events ───────────────────────────────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http')) {
      shell.openExternal(targetUrl);
    }
    return { action: 'deny' };
  });

  // Build the application menu
  buildAppMenu();
}

// ─── Wait for Vite dev server ─────────────────────────────────────────────────
async function waitForDevServer(serverUrl, maxRetries = 30, retryIntervalMs = 1000) {
  const http = require('http');
  const https = serverUrl.startsWith('https') ? require('https') : http;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = https.get(serverUrl, (res) => {
          if (res.statusCode < 500) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      console.log('[Electron] Dev server is ready.');
      return;
    } catch {
      console.log(`[Electron] Waiting for dev server... (${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, retryIntervalMs));
    }
  }
  console.warn('[Electron] Dev server did not respond in time. Loading anyway.');
}

// ─── Application Menu ─────────────────────────────────────────────────────────
function buildAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
        { type: 'separator' },
        ...(isDev
          ? [
              {
                label: 'Toggle Developer Tools',
                accelerator: 'CmdOrCtrl+Shift+I',
                click: () => mainWindow?.webContents.toggleDevTools(),
              },
            ]
          : []),
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        {
          label: 'Maximize',
          click: () => {
            if (mainWindow) {
              mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
            }
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Connect App Admin',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Connect App Admin',
              message: 'Connect App Admin Portal',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChromium: ${process.versions.chrome}`,
            });
          },
        },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:get-path', (_, name) => app.getPath(name));
ipcMain.handle('app:is-dev', () => isDev);

ipcMain.handle('dialog:show-message', async (_, options) => {
  return dialog.showMessageBox(mainWindow, options);
});

ipcMain.handle('shell:open-external', (_, targetUrl) => {
  shell.openExternal(targetUrl);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close(() => console.log('[Electron] Local server closed.'));
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Security: Prevent new window navigation hijacking ───────────────────────
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new url.URL(navigationUrl);
    const allowed = ['localhost', '127.0.0.1', 'api.ficapp.in'];
    if (!allowed.includes(parsedUrl.hostname)) {
      event.preventDefault();
    }
  });
});
