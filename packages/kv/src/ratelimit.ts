// Note: Removed server-only import as it conflicts with Bun runtime
// The KV package is inherently server-side only by design

import { Ratelimit } from "@upstash/ratelimit";
import { client, isRedisAvailable } from ".";

// Create ratelimit only if Redis is available, otherwise create a mock
export const ratelimit = client
  ? new Ratelimit({
      limiter: Ratelimit.fixedWindow(10, "10s"),
      redis: client,
    })
  : {
      // Mock ratelimit for development when Redis is not configured
      limit: async (identifier: string) => ({
        success: true,
        remaining: 10,
        limit: 10,
        pending: Promise.resolve(),
        reset: Date.now() + 10000,
      }),
    };

export { isRedisAvailable };
