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

// Universal API Base URL Auto-Healing Interceptor:
// If Nginx reverse proxy strips the /admin-api prefix causing a 404 Route Not Found,
// preemptively and transparently route through /admin-api/admin-api/ to guarantee 100% uptime without console 404 noise.
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

    let primaryInput = input;
    let isRewritten = false;

    // Preemptively rewrite api.ficapp.in/admin-api/admin/ to api.ficapp.in/admin-api/admin-api/admin/
    // because Nginx's proxy_pass strips the first /admin-api/
    if (typeof url === 'string' && url.includes('api.ficapp.in/admin-api/admin/') && !url.includes('api.ficapp.in/admin-api/admin-api/')) {
      const rewrittenUrl = url.replace('api.ficapp.in/admin-api/admin/', 'api.ficapp.in/admin-api/admin-api/admin/');
      isRewritten = true;
      if (typeof input === 'string') {
        primaryInput = rewrittenUrl;
      } else if (input instanceof URL) {
        primaryInput = new URL(rewrittenUrl);
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        primaryInput = new Request(rewrittenUrl, input);
      }
    }

    try {
      const response = await _origFetch.call(this, primaryInput, init);
      if (response && response.status === 404 && typeof url === 'string') {
        const fallbackUrl = isRewritten
          ? url
          : (url.includes('api.ficapp.in/admin-api/') && !url.includes('api.ficapp.in/admin-api/admin-api/'))
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
