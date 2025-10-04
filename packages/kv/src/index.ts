// Note: Removed server-only import as it conflicts with Bun runtime
// The KV package is inherently server-side only by design

// Lazy initialization of Redis client
let _client: any = null;
let _initialized = false;

// Helper to check if Redis is available
export const isRedisAvailable = () => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
};

// Lazy initialization of Redis client to avoid import errors
export const client = new Proxy({} as any, {
  get(target, prop) {
    if (!_initialized) {
      _initialized = true;
      if (isRedisAvailable()) {
        try {
          // Dynamic import to avoid loading Redis package when env vars are missing
          const { Redis } = require("@upstash/redis");
          _client = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
        } catch (error) {
          console.warn("Failed to initialize Redis client:", error);
          _client = null;
        }
      } else {
        _client = null;
      }
    }

    if (!_client) {
      throw new Error("Redis client not available - check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables");
    }

    return _client[prop];
  }
});
