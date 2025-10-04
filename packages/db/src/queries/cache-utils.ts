import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { z } from "zod";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export async function generateProductListCacheKey(input: any) {
  const sortedInput = JSON.stringify(input, Object.keys(input).sort());
  let cacheKey = `product-list:${createHash("sha256").update(sortedInput).digest("hex")}`;

  if (input.filters?.brandIds && input.filters.brandIds.length > 0) {
    // Assuming single brandId for simplicity, or concatenate if multiple
    const brandId = input.filters.brandIds[0];
    const brandVersion = await redis.get(`brand_version:${brandId}`);
    if (brandVersion) {
      cacheKey += `:v${brandVersion}`;
    }
  }
  return cacheKey;
}
