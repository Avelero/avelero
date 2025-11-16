import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { client } from "@v1/kv/client";

// Contact form specific rate limiter - 3 submissions per hour
export const contactFormRateLimit = new Ratelimit({
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  redis: client,
});
