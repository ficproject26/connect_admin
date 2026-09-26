/**
 * High-Performance Resilient Cache Service for Admin Portal
 * Features:
 * 1. Ultra-fast in-memory cache with TTL and automatic memory cleanup.
 * 2. Optional Redis backend support if REDIS_URL or REDIS_HOST is configured.
 * 3. Graceful degradation: If Redis is offline or errors, silently falls back to in-memory cache.
 * 4. Zero crashes, zero unhandled rejections, non-blocking asynchronous wrappers.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
    // Periodically evict expired keys every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  get(key) {
    if (!this.store.has(key)) return null;
    const expiry = this.ttls.get(key);
    if (expiry && Date.now() > expiry) {
      this.del(key);
      return null;
    }
    return this.store.get(key);
  }

  set(key, value, ttlSeconds = 60) {
    this.store.set(key, value);
    if (ttlSeconds && ttlSeconds > 0) {
      this.ttls.set(key, Date.now() + (ttlSeconds * 1000));
    } else {
      this.ttls.delete(key);
    }
    return true;
  }

  del(key) {
    this.store.delete(key);
    this.ttls.delete(key);
    return true;
  }

  delPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*'));
    let count = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.del(key);
        count++;
      }
    }
    return count;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.ttls.entries()) {
      if (now > expiry) {
        this.del(key);
      }
    }
  }

  flushAll() {
    this.store.clear();
    this.ttls.clear();
  }

  size() {
    return this.store.size;
  }
}

class CacheService {
  constructor() {
    this.memory = new MemoryCache();
    this.redisClient = null;
    this.isRedisReady = false;
    this.initRedis();
  }

  initRedis() {
    let redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);
    if (!redisUrl) {
      // In-memory cache is active by default
      return;
    }
    // Clean any prefix like 'redis-cli -u ' if accidentally pasted
    redisUrl = redisUrl.replace(/^redis-cli\s+-u\s+/i, '').trim();

    try {
      let Redis;
      try {
        Redis = require('ioredis');
        this.redisClient = new Redis(redisUrl, {
          connectTimeout: 5000,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true
        });
        this.isIoRedis = true;
      } catch (err) {
        const redis = require('redis');
        this.redisClient = redis.createClient({ url: redisUrl, socket: { connectTimeout: 5000 } });
        this.redisClient.connect().catch(() => {
          this.isRedisReady = false;
        });
        this.isIoRedis = false;
      }
      
      this.redisClient.on('error', (err) => {
        // Silent graceful fallback to in-memory cache
        this.isRedisReady = false;
      });

      this.redisClient.on('ready', () => {
        this.isRedisReady = true;
      });

      this.redisClient.on('connect', () => {
        this.isRedisReady = true;
      });
    } catch (e) {
      // Redis package not installed or failed to initialize, memory cache continues seamlessly
      this.isRedisReady = false;
    }
  }

  async get(key) {
    if (this.isRedisReady && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        if (val !== null) return JSON.parse(val);
      } catch (e) {
        // Fallback to memory
      }
    }
    return this.memory.get(key);
  }

  async set(key, value, ttlSeconds = 60) {
    this.memory.set(key, value, ttlSeconds);
    if (this.isRedisReady && this.redisClient) {
      try {
        const str = JSON.stringify(value);
        if (ttlSeconds > 0) {
          if (this.isIoRedis) {
            await this.redisClient.set(key, str, 'EX', ttlSeconds);
          } else if (typeof this.redisClient.setEx === 'function') {
            await this.redisClient.setEx(key, ttlSeconds, str);
          } else {
            await this.redisClient.set(key, str, 'EX', ttlSeconds);
          }
        } else {
          await this.redisClient.set(key, str);
        }
      } catch (e) {
        // Memory cache already set
      }
    }
    return true;
  }

  async del(key) {
    this.memory.del(key);
    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (e) {}
    }
    return true;
  }

  async delPattern(pattern) {
    this.memory.delPattern(pattern);
    if (this.isRedisReady && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (e) {}
    }
    return true;
  }

  /**
   * Helper: Wrap an async DB fetch with caching
   * @param {string} key Cache key
   * @param {number} ttlSeconds TTL in seconds
   * @param {Function} fetchFn Function returning promise with data
   */
  async wrap(key, ttlSeconds, fetchFn) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await fetchFn();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }
}

const cacheService = new CacheService();
module.exports = cacheService;
