# Connect App Admin — Electron Desktop Application

This document explains how to run and package the **Connect App Admin Portal** as a Windows desktop application using Electron.

---

## Architecture Overview

```
project root/
├── backend/                  ← Express + MongoDB API server (unchanged)
├── frontend/                 ← Vite + React web app (unchanged)
│   ├── src/
│   ├── dist/                 ← Built output (used in production Electron)
│   └── package.json
├── electron/                 ← Electron wrapper (NEW)
│   ├── main.js               ← Main process
│   ├── preload.js            ← Secure context bridge
│   ├── package.json          ← Electron dependencies + builder config
│   └── assets/               ← Icons for installer (see assets/README.md)
├── dist-electron/            ← Packaged installer output (git-ignored)
├── start-desktop-dev.bat     ← One-click dev launcher (Windows)
├── build-desktop-win.bat     ← One-click build + package (Windows)
└── package.json              ← Root scripts
```

---

## How It Works

| Mode | Frontend | Backend |
|------|----------|---------|
| **Development** | Electron loads http://localhost:5173 (Vite dev server) | Runs separately on port 8004 |
| **Production** | Electron serves frontend/dist/ via local HTTP server | Runs separately on port 8004 |

> The backend always runs as a separate Node.js process — NOT bundled into Electron.

---

## Development Mode (Hot Reload)

### Option A — One-click Batch Script
```
Double-click: start-desktop-dev.bat
```

### Option B — NPM script (from project root)
```bash
npm run electron:dev
```

### Option C — Manual
```bash
# Terminal 1
cd backend && node server.js

# Terminal 2
cd frontend && npm run dev

# Terminal 3 (after servers are ready)
cd electron && npm run start:dev
```

---

## Production Build & Packaging

### One-click
```
Double-click: build-desktop-win.bat
```

### Manual
```bash
cd frontend && npm run build
cd ../electron && npm install && npx electron-builder --win
```

Output: `dist-electron/Connect App Admin Setup 1.0.0.exe`

---

## Icons (Optional)

Place icon files in `electron/assets/`:
- `icon.ico` — Windows (256x256 ICO)
- `icon.icns` — macOS (optional)

---

## Security

- `contextIsolation: true` + `nodeIntegration: false` — renderer is isolated
- External links open in OS browser
- Navigation locked to localhost + api.ficapp.in

---

## Web vs Desktop

Both use the same source/API/auth with zero divergence:
- `npm run dev` — runs as web app
- `npm run electron:dev` — runs as desktop app
