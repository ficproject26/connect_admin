/**
 * DataSyncManager — Centralized Frontend Data Fetching, Deduplication, & Real-Time Sync Engine
 * 
 * Features:
 * 1. Single-flight request deduplication (merges concurrent duplicate requests).
 * 2. In-memory Stale-While-Revalidate (SWR) cache for 0ms initial render.
 * 3. Tab-visibility aware background polling (default 5s interval, pauses when hidden, resumes immediately on focus).
 * 4. Targeted query invalidation on mutations (no window.location.reload required).
 * 5. Reactive subscription listeners for components.
 */

class DataSyncManager {
  constructor() {
    this.cache = new Map();
    this.pendingPromises = new Map();
    this.subscribers = new Map(); // key -> Set of callback functions
    this.pollingKeys = new Set(); // keys registered for background polling
    this.pollInterval = 5000; // 5 seconds
    this.timerId = null;
    this.token = null;
    this.apiBase = '';

    if (typeof window !== 'undefined') {
      this.initTabListeners();
    }
  }

  setAuthConfig(token, apiBase) {
    this.token = token;
    this.apiBase = apiBase || '';
    if (token && !this.timerId) {
      this.startPolling();
    } else if (!token) {
      this.stopPolling();
      this.cache.clear();
    }
  }

  initTabListeners() {
    const handleVisibilityOrFocusChange = () => {
      if (document.visibilityState === 'visible' && (typeof navigator === 'undefined' || navigator.onLine)) {
        this.refetchAllActive();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocusChange);
    window.addEventListener('focus', handleVisibilityOrFocusChange);
    window.addEventListener('online', handleVisibilityOrFocusChange);
  }

  getHeaders() {
    return {
      'x-auth-token': this.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''),
      'Content-Type': 'application/json'
    };
  }

  /**
   * Safe fetch with request deduplication
   */
  async fetchQuery(key, url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
    const { force = false, ttl = 3000 } = options;

    // Check SWR Cache
    const cached = this.cache.get(key);
    if (!force && cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    // Request Deduplication: Return pending promise if request is already in-flight
    if (this.pendingPromises.has(key)) {
      return this.pendingPromises.get(key);
    }

    const fetchPromise = (async () => {
      try {
        const token = this.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
        if (!token) return null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(fullUrl, {
          headers: this.getHeaders(),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.status === 401 || res.status === 403) {
          this.notifySubscribers(key, null, new Error('Unauthorized'));
          return null;
        }

        if (res.ok) {
          const data = await res.json();
          this.cache.set(key, { data, timestamp: Date.now() });
          this.notifySubscribers(key, data);
          return data;
        }
      } catch (err) {
        console.warn(`[DataSyncManager] Fetch error for key '${key}':`, err.message || err);
      } finally {
        this.pendingPromises.delete(key);
      }
      return cached ? cached.data : null;
    })();

    this.pendingPromises.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Subscribe to updates for a specific query key
   */
  subscribe(key, callback, urlToPoll = null) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    if (urlToPoll) {
      this.pollingKeys.add(JSON.stringify({ key, url: urlToPoll }));
    }

    // Return cached data immediately if available
    if (this.cache.has(key)) {
      callback(this.cache.get(key).data);
    }

    // Return unsubscribe cleanup function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);
          if (urlToPoll) {
            this.pollingKeys.delete(JSON.stringify({ key, url: urlToPoll }));
          }
        }
      }
    };
  }

  notifySubscribers(key, data, error = null) {
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach(cb => {
        try {
          cb(data, error);
        } catch (e) {
          console.error(`[DataSyncManager] Subscriber callback error:`, e);
        }
      });
    }
  }

  /**
   * Invalidate query/queries on mutation and immediately trigger refetch
   */
  async invalidateQuery(keyOrKeys, options = {}) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    for (const key of keys) {
      this.cache.delete(key);
      // Find matching polled item
      for (const itemStr of this.pollingKeys) {
        const item = JSON.parse(itemStr);
        if (item.key === key) {
          await this.fetchQuery(item.key, item.url, { force: true });
        }
      }
    }
  }

  /**
   * Master polling loop (only runs when tab is active and user is authenticated)
   */
  startPolling() {
    this.stopPolling();
    this.timerId = setInterval(() => {
      if (document.visibilityState === 'visible' && (typeof navigator === 'undefined' || navigator.onLine)) {
        this.refetchAllActive();
      }
    }, this.pollInterval);
  }

  stopPolling() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  refetchAllActive() {
    if (!this.token) return;
    for (const itemStr of this.pollingKeys) {
      try {
        const { key, url } = JSON.parse(itemStr);
        if (this.subscribers.has(key) && this.subscribers.get(key).size > 0) {
          this.fetchQuery(key, url, { force: true });
        }
      } catch (e) {}
    }
  }

  getCachedData(key) {
    return this.cache.get(key)?.data || null;
  }
}

export const dataSyncManager = new DataSyncManager();
export default dataSyncManager;
