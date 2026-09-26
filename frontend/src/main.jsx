import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress third-party Chrome Extension background script noise in console
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('A listener indicated an asynchronous response') ||
    event.reason?.message?.includes('message channel closed')
  ) {
    event.preventDefault();
  }
});

// Auto-recover from stale chunks after new deployments on Vercel
const triggerDeploymentReload = (source, err) => {
  console.warn(`[Auto-Recovery] Dynamic chunk load failed via ${source}. Reloading to fetch latest deployment...`, err);
  const lastReload = sessionStorage.getItem('chunk_reload_timestamp');
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 8000) {
    sessionStorage.setItem('chunk_reload_timestamp', String(now));
    window.location.reload();
  }
};

window.addEventListener('vite:preloadError', (event) => {
  triggerDeploymentReload('vite:preloadError', event);
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('ChunkLoadError')
  ) {
    triggerDeploymentReload('window:error', event);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
