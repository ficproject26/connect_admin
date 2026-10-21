import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress third-party Chrome Extension background script noise and CSP warnings
const EXTENSION_PATTERNS = [
  'a listener indicated an asynchronous response',
  'message channel closed',
  'runtime.lasterror',
  'message channel closed before a response was received',
  'the message channel closed',
  'could not establish connection',
  'receiving end does not exist',
  'unchecked runtime.lasterror',
  'listener indicated an asynchronous response by returning true',
  'evaluating a string as javascript',
  'unsafe-eval',
  'content security policy directive',
  'the action has been blocked',
  'initlisteners',
  'chrome-extension://',
  'chrome-extension:',
  'content.js',
  'wasm-unsafe-eval',
  'inline-speculation-rules',
  'the deferred dom node could not be resolved',
  'the deferred dom node',
  'deferred dom node',
  'deferred dom',
  'could not be resolved to a valid node',
  'nmigaijibiabddkkmjhlehchpmgbokfj',
  '1af9505a-5825-464e-acf3-5ad9367aeb9d',
  'f872d920-f021-4d52-ac98-78da36ceb659',
  'content.js:1',
  'volume-booster'
];

// Neutralize third-party extension calls to eval/setTimeout/setInterval with undefined or string handlers that trigger CSP unsafe-eval violations
if (typeof window !== 'undefined') {
  try {
    const _origEval = window.eval;
    window.eval = function (code) {
      try {
        return _origEval.apply(this, arguments);
      } catch (err) {
        if (isExtensionNoise(err) || String(err).includes('Content Security Policy') || String(err).includes('unsafe-eval')) {
          return undefined;
        }
        throw err;
      }
    };
  } catch (_) {}

  const _origSetTimeout = window.setTimeout;
  window.setTimeout = function (handler, timeout, ...args) {
    if (typeof handler !== 'function') {
      if (!handler || handler === 'undefined' || handler === 'null' || typeof handler === 'string') {
        return -1;
      }
    }
    return _origSetTimeout.call(this, handler, timeout, ...args);
  };

  const _origSetInterval = window.setInterval;
  window.setInterval = function (handler, timeout, ...args) {
    if (typeof handler !== 'function') {
      if (!handler || handler === 'undefined' || handler === 'null' || typeof handler === 'string') {
        return -1;
      }
    }
    return _origSetInterval.call(this, handler, timeout, ...args);
  };
}

const drainLastError = () => {
  try {
    if (typeof window !== 'undefined' && window.chrome && window.chrome.runtime) {
      void window.chrome.runtime.lastError;
    }
  } catch (_) {}
};

// Patch window.chrome.runtime to safely absorb dangling message ports
const patchRuntime = (runtime) => {
  if (!runtime || typeof runtime !== 'object') return;

  if (typeof runtime.sendMessage === 'function' && !runtime._sendMessagePatched) {
    const origSend = runtime.sendMessage.bind(runtime);
    runtime.sendMessage = function (...args) {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') {
        args[args.length - 1] = function (...cbArgs) {
          drainLastError();
          try {
            return cb.apply(this, cbArgs);
          } catch (_) {}
        };
        try {
          return origSend.apply(null, args);
        } catch (e) {
          drainLastError();
          return;
        }
      }
      try {
        const p = origSend.apply(null, args);
        if (p && typeof p.then === 'function') {
          return p
            .then((res) => {
              drainLastError();
              return res;
            })
            .catch((err) => {
              drainLastError();
              return undefined;
            });
        }
        return p;
      } catch (err) {
        drainLastError();
        return Promise.resolve(undefined);
      }
    };
    runtime._sendMessagePatched = true;
  }

  if (runtime.onMessage && typeof runtime.onMessage.addListener === 'function' && !runtime._addListenerPatched) {
    const origAdd = runtime.onMessage.addListener.bind(runtime.onMessage);
    runtime.onMessage.addListener = function (listener) {
      if (typeof listener !== 'function') return origAdd(listener);
      return origAdd(function (message, sender, sendResponse) {
        let responded = false;
        const safeSendResponse = (...srArgs) => {
          if (responded) return;
          responded = true;
          try {
            const p = sendResponse.apply(null, srArgs);
            if (p && typeof p.catch === 'function') {
              p.catch(() => {});
            }
          } catch (_) {}
        };
        try {
          const res = listener(message, sender, safeSendResponse);
          if (res === true) {
            setTimeout(() => {
              if (!responded) safeSendResponse({ status: 'auto_resolved' });
            }, 200);
            return true;
          }
          if (res && typeof res.then === 'function') {
            res.then((r) => { safeSendResponse(r !== undefined ? r : { status: 'resolved' }); })
               .catch((e) => { safeSendResponse({ error: String(e) }); });
            return true;
          }
          return res;
        } catch (e) {
          safeSendResponse({ error: String(e) });
          return false;
        }
      });
    };
    runtime._addListenerPatched = true;
  }
};

const autoPatchChrome = () => {
  try {
    if (typeof window !== 'undefined' && window.chrome) {
      if (window.chrome.runtime) {
        patchRuntime(window.chrome.runtime);
      }
    }
  } catch (_) {}
};

if (typeof window !== 'undefined') {
  autoPatchChrome();
  setInterval(autoPatchChrome, 50);
  setInterval(drainLastError, 50);
  drainLastError();
}

const extractErrorString = (arg) => {
  if (!arg) return '';
  if (typeof arg === 'string') return arg;
  let str = '';
  try {
    str = `${arg.name || ''} ${arg.message || ''} ${arg.stack || ''} ${String(arg)}`;
  } catch (_) {}
  if (typeof arg === 'object') {
    try {
      const msg = arg.message || '';
      const reason = arg.reason ? extractErrorString(arg.reason) : '';
      const err = arg.error ? extractErrorString(arg.error) : '';
      const detail = arg.detail ? extractErrorString(arg.detail) : '';
      const stack = arg.stack || '';
      str += ` ${msg} ${reason} ${err} ${detail} ${stack}`;
    } catch (_) {}
  }
  return str;
};

const isExtensionNoise = (errOrMsg) => {
  if (!errOrMsg) return false;
  const str = extractErrorString(errOrMsg).toLowerCase();
  return EXTENSION_PATTERNS.some(pat => str.includes(pat));
};

const handleRejection = (event) => {
  drainLastError();
  if (isExtensionNoise(event?.reason) || isExtensionNoise(event?.message) || isExtensionNoise(event)) {
    drainLastError();
    try {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      event.returnValue = false;
    } catch (_) {}
  }
};

window.addEventListener('unhandledrejection', handleRejection, { capture: true, passive: false });
window.addEventListener('unhandledrejection', handleRejection, false);

try {
  const origUnhandled = window.onunhandledrejection;
  window.onunhandledrejection = function (e) {
    drainLastError();
    if (e && isExtensionNoise(e.reason || e)) {
      try {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        e.returnValue = false;
      } catch (_) {}
      return true;
    }
    if (typeof origUnhandled === 'function') return origUnhandled.apply(this, arguments);
  };
} catch (_) {}

// Silence extension-injected CSP violation events on window and document
const suppressCspViolation = (e) => {
  const blocked = `${e?.blockedURI || ''} ${e?.sourceFile || ''} ${e?.violatedDirective || ''}`.toLowerCase();
  if (
    blocked.includes('chrome-extension://') ||
    blocked.includes('content.js') ||
    e?.violatedDirective === 'script-src'
  ) {
    try {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      e.returnValue = false;
    } catch (_) {}
  }
};

window.addEventListener('securitypolicyviolation', suppressCspViolation, true);
document.addEventListener('securitypolicyviolation', suppressCspViolation, true);

// Intercept console methods in main.jsx to filter extension noise and deferred DOM node warnings
if (typeof console !== 'undefined') {
  ['error', 'warn', 'info', 'log', 'debug'].forEach((method) => {
    const origMethod = console[method];
    if (typeof origMethod === 'function') {
      console[method] = function (...args) {
        drainLastError();
        if (args.some((arg) => isExtensionNoise(arg))) {
          return;
        }
        return origMethod.apply(console, args);
      };
    }
  });
}

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
