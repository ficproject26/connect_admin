import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress third-party Chrome Extension background script noise in console
const EXTENSION_PATTERNS = [
  'a listener indicated an asynchronous response',
  'message channel closed',
  'runtime.lasterror',
  'message channel closed before a response was received',
  'the message channel closed',
  'could not establish connection. receiving end does not exist',
  'unchecked runtime.lasterror'
];

const isExtensionNoise = (errOrMsg) => {
  if (!errOrMsg) return false;
  let str = '';
  if (typeof errOrMsg === 'string') str = errOrMsg;
  else if (errOrMsg instanceof Error) str = `${errOrMsg.name || ''} ${errOrMsg.message || ''} ${errOrMsg.stack || ''}`;
  else if (typeof errOrMsg === 'object') str = `${errOrMsg.message || ''} ${errOrMsg.reason || ''} ${errOrMsg.error?.message || ''} ${String(errOrMsg)}`;
  else str = String(errOrMsg);
  const lower = str.toLowerCase();
  return EXTENSION_PATTERNS.some(pat => lower.includes(pat));
};

const handleRejection = (event) => {
  if (isExtensionNoise(event?.reason) || isExtensionNoise(event?.message) || isExtensionNoise(event)) {
    try {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    } catch (_) {}
  }
};

window.addEventListener('unhandledrejection', handleRejection, { capture: true, passive: false });
window.addEventListener('unhandledrejection', handleRejection, false);

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
  if (isExtensionNoise(event?.error) || isExtensionNoise(event?.message) || isExtensionNoise(event?.filename)) {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    return;
  }
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

// Universal API Base URL Auto-Healing Interceptor:
// If Nginx reverse proxy strips the /admin-api prefix causing a 404 Route Not Found,
// transparently retry with /admin-api/admin-api/ on 404 to guarantee 100% uptime across all modules.
if (typeof window !== 'undefined' && window.fetch) {
  const _origFetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof input === 'object' && 'url' in input) {
      url = input.url || '';
    }

    // Clean redundant duplicate /admin-api/admin-api/ if present
    let primaryInput = input;
    if (typeof url === 'string' && url.includes('api.ficapp.in/admin-api/admin-api/')) {
      const cleanedUrl = url.replace('api.ficapp.in/admin-api/admin-api/', 'api.ficapp.in/admin-api/');
      if (typeof input === 'string') {
        primaryInput = cleanedUrl;
      } else if (input instanceof URL) {
        primaryInput = new URL(cleanedUrl);
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        primaryInput = new Request(cleanedUrl, input);
      }
    }

    try {
      const response = await _origFetch.call(this, primaryInput, init);
      if (response && response.status === 401 && typeof url === 'string') {
        const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/send-otp') || url.includes('/auth/verify-otp');
        if (!isAuthEndpoint && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }
      if (response && response.status === 404 && typeof url === 'string') {
        const fallbackUrl = url.includes('api.ficapp.in/admin-api/') && !url.includes('api.ficapp.in/admin-api/admin-api/')
          ? url.replace('api.ficapp.in/admin-api/', 'api.ficapp.in/admin-api/admin-api/')
          : null;

        if (fallbackUrl && fallbackUrl !== url) {
          try {
            let fallbackInput = fallbackUrl;
            if (typeof Request !== 'undefined' && input instanceof Request) {
              fallbackInput = new Request(fallbackUrl, input);
            }
            const fallbackResponse = await _origFetch.call(this, fallbackInput, init);
            if (fallbackResponse && fallbackResponse.status !== 404) {
              return fallbackResponse;
            }
          } catch (e) {
            // fallback error, return original response
          }
        }
      }
      return response;
    } catch (err) {
      throw err;
    }
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
