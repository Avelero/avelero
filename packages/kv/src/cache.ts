// Note: Removed server-only import as it conflicts with Bun runtime
// The KV package is inherently server-side only by design

import { client, isRedisAvailable } from "./index.js";

// Default TTL configurations (in seconds)
export const CACHE_TTL = {
  METRICS: 300, // 5 minutes for dashboard metrics
  AGGREGATES: 600, // 10 minutes for complex aggregates
  QUICK_STATS: 60, // 1 minute for frequently changing stats
} as const;

// Cache key prefixes for organization
export const CACHE_KEYS = {
  PRODUCTS: "products",
  PASSPORTS: "passports",
  VARIANTS: "variants",
  TEMPLATES: "templates",
  MODULES: "modules",
} as const;

/**
 * Generate a cache key for metrics with brand scoping
 */
export function generateCacheKey(
  resource: keyof typeof CACHE_KEYS,
  brandId: string,
  metric: string,
  filters?: Record<string, any>,
): string {
  const baseKey = `metrics:${CACHE_KEYS[resource]}:${brandId}:${metric}`;

  if (!filters || Object.keys(filters).length === 0) {
    return baseKey;
  }

  // Create deterministic hash of filters for consistent cache keys
  const filterStr = JSON.stringify(filters);
  const filterHash = Buffer.from(filterStr).toString("base64url").slice(0, 8);
  return `${baseKey}:${filterHash}`;
}

/**
 * Get cached metrics with automatic JSON parsing
 */
export async function getCachedMetrics<T = any>(
  cacheKey: string,
): Promise<T | null> {
  if (!isRedisAvailable() || !client) {
    return null;
  }

  try {
    const cached = await client.get(cacheKey);
    return cached as T | null;
  } catch (error) {
    console.error(`Failed to get cached metrics for key ${cacheKey}:`, error);
    return null;
  }
}

/**
 * Set cached metrics with TTL and automatic JSON serialization
 */
export async function setCachedMetrics<T = any>(
  cacheKey: string,
  data: T,
  ttlSeconds: number = CACHE_TTL.METRICS,
): Promise<void> {
  if (!isRedisAvailable() || !client) {
    return;
  }

  try {
    await client.setex(cacheKey, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to set cached metrics for key ${cacheKey}:`, error);
    // Don't throw - caching failures should not break the application
  }
}

/**
 * Get or compute metrics with caching
 * This is the main utility function following the pattern from CLAUDE.md
 */
export async function getOrComputeMetrics<T = any>(
  resource: keyof typeof CACHE_KEYS,
  brandId: string,
  metric: string,
  computeFn: () => Promise<T>,
  options: {
    filters?: Record<string, any>;
    ttl?: number;
    skipCache?: boolean;
  } = {},
): Promise<T> {
  const { filters, ttl = CACHE_TTL.METRICS, skipCache = false } = options;

  // Skip cache if requested (useful for debugging or forced refresh)
  if (skipCache) {
    return await computeFn();
  }

  const cacheKey = generateCacheKey(resource, brandId, metric, filters);

  // Try to get from cache first
  const cached = await getCachedMetrics<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - compute the metrics
  const computed = await computeFn();

  // Store in cache for future requests
  await setCachedMetrics(cacheKey, computed, ttl);

  return computed;
}

/**
 * Batch invalidation of cache keys matching a pattern
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  if (!isRedisAvailable() || !client) {
    return 0;
  }

  try {
    // Get all keys matching pattern
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    // Delete all matching keys
    await client.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`Failed to invalidate cache pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Invalidate all metrics for a specific brand and resource
 */
export async function invalidateBrandMetrics(
  resource: keyof typeof CACHE_KEYS,
  brandId: string,
): Promise<number> {
  const pattern = `metrics:${CACHE_KEYS[resource]}:${brandId}:*`;
  return invalidateCachePattern(pattern);
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  info: Record<string, string>;
  keyCount: number;
  memoryUsage?: string;
}> {
  if (!isRedisAvailable() || !client) {
    return {
      info: { status: "Redis not available" },
      keyCount: 0,
    };
  }

  try {
    const info = await client.info();
    const dbsize = await client.dbsize();

    // Parse info string into object
    const infoObj: Record<string, string> = {};
    if (typeof info === "string") {
      for (const line of info.split("\n")) {
        const [key, value] = line.split(":");
        if (key && value) {
          infoObj[key.trim()] = value.trim();
        }
      }
    }

    return {
      info: infoObj,
      keyCount: dbsize,
      memoryUsage: infoObj.used_memory_human,
    };
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    return {
      info: {},
      keyCount: 0,
    };
  }
}
