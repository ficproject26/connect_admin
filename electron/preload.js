'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a safe, limited API to the renderer process via window.electronAPI.
 * No direct Node/Electron APIs are exposed — only explicit IPC bridges.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── App info ────────────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getPath: (name) => ipcRenderer.invoke('app:get-path', name),
  isDev: () => ipcRenderer.invoke('app:is-dev'),

  // ── Dialogs ─────────────────────────────────────────────────────────────────
  showMessage: (options) => ipcRenderer.invoke('dialog:show-message', options),

  // ── Shell ───────────────────────────────────────────────────────────────────
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // ── Platform detection ───────────────────────────────────────────────────────
  platform: process.platform,
  isElectron: true,
});
