// Note: Removed server-only import as it conflicts with Bun runtime
// The KV package is inherently server-side only by design

import {
  CACHE_KEYS,
  invalidateBrandMetrics,
  invalidateCachePattern,
} from "./cache.js";

/**
 * Invalidation strategies for different data mutation types
 */

/**
 * Invalidate product-related caches when products are modified
 */
export async function invalidateProductCaches(brandId: string): Promise<void> {
  await Promise.all([
    // Invalidate direct product metrics
    invalidateBrandMetrics("PRODUCTS", brandId),
    // Product changes may affect variant statistics
    invalidateBrandMetrics("VARIANTS", brandId),
    // Product changes may affect passport linkages
    invalidateBrandMetrics("PASSPORTS", brandId),
  ]);
}

/**
 * Invalidate variant-related caches when variants are modified
 */
export async function invalidateVariantCaches(brandId: string): Promise<void> {
  await Promise.all([
    // Invalidate variant metrics
    invalidateBrandMetrics("VARIANTS", brandId),
    // Variant changes affect product statistics (variant counts)
    invalidateBrandMetrics("PRODUCTS", brandId),
    // Variant changes may affect passport linkages
    invalidateBrandMetrics("PASSPORTS", brandId),
  ]);
}

/**
 * Invalidate passport-related caches when passports are modified
 */
export async function invalidatePassportCaches(brandId: string): Promise<void> {
  await Promise.all([
    // Invalidate passport metrics
    invalidateBrandMetrics("PASSPORTS", brandId),
    // Passport changes may affect product completion stats
    invalidateBrandMetrics("PRODUCTS", brandId),
    // Passport changes may affect module completion stats
    invalidateBrandMetrics("MODULES", brandId),
  ]);
}

/**
 * Invalidate template-related caches when templates are modified
 */
export async function invalidateTemplateCaches(brandId: string): Promise<void> {
  await Promise.all([
    // Invalidate template metrics
    invalidateBrandMetrics("TEMPLATES", brandId),
    // Template changes may affect passport structure
    invalidateBrandMetrics("PASSPORTS", brandId),
    // Template changes may affect module usage
    invalidateBrandMetrics("MODULES", brandId),
  ]);
}

/**
 * Invalidate module-related caches when modules are modified
 */
export async function invalidateModuleCaches(brandId: string): Promise<void> {
  await Promise.all([
    // Invalidate module metrics
    invalidateBrandMetrics("MODULES", brandId),
    // Module changes may affect template completeness
    invalidateBrandMetrics("TEMPLATES", brandId),
    // Module changes may affect passport completion
    invalidateBrandMetrics("PASSPORTS", brandId),
  ]);
}

/**
 * Nuclear option: invalidate all caches for a brand
 * Use when major structural changes occur
 */
export async function invalidateAllBrandCaches(brandId: string): Promise<void> {
  await Promise.all([
    invalidateBrandMetrics("PRODUCTS", brandId),
    invalidateBrandMetrics("VARIANTS", brandId),
    invalidateBrandMetrics("PASSPORTS", brandId),
    invalidateBrandMetrics("TEMPLATES", brandId),
    invalidateBrandMetrics("MODULES", brandId),
  ]);
}

/**
 * Selective invalidation for specific metric types
 * Useful when you know exactly which metrics are affected
 */
export async function invalidateSpecificMetrics(
  resource: keyof typeof CACHE_KEYS,
  brandId: string,
  metricNames: string[],
): Promise<void> {
  const patterns = metricNames.map(
    (metric) => `metrics:${CACHE_KEYS[resource]}:${brandId}:${metric}*`,
  );

  await Promise.all(patterns.map((pattern) => invalidateCachePattern(pattern)));
}

/**
 * Time-based cache warming for critical metrics
 * Call this during low-traffic periods to pre-compute expensive aggregates
 */
export interface CacheWarmupConfig {
  resource: keyof typeof CACHE_KEYS;
  brandId: string;
  metrics: string[];
  computeFn: (metric: string) => Promise<any>;
}

export async function warmupCache(config: CacheWarmupConfig): Promise<void> {
  const { resource, brandId, metrics, computeFn } = config;

  // Compute metrics in parallel but limit concurrency to avoid overwhelming the DB
  const BATCH_SIZE = 3;

  for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
    const batch = metrics.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (metric) => {
        try {
          // Force recomputation by skipping cache
          await computeFn(metric);
        } catch (error) {
          console.error(
            `Cache warmup failed for ${resource}:${brandId}:${metric}:`,
            error,
          );
          // Continue with other metrics even if one fails
        }
      }),
    );
  }
}

/**
 * Cache health check - identify stale or problematic cache entries
 */
export async function checkCacheHealth(): Promise<{
  totalKeys: number;
  metricKeys: number;
  oldestKey?: string;
  newestKey?: string;
}> {
  try {
    // Get all metric keys
    const metricKeys = await invalidateCachePattern("metrics:*");
    const totalKeys = await invalidateCachePattern("*");

    return {
      totalKeys,
      metricKeys,
      // In a real implementation, you might track key timestamps
      // For now, just return basic counts
    };
  } catch (error) {
    console.error("Cache health check failed:", error);
    return {
      totalKeys: 0,
      metricKeys: 0,
    };
  }
}
