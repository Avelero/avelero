/**
 * Base Connector Utilities
 *
 * Shared utilities for API communication, rate limiting, etc.
 */

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Get a value from a nested object using dot notation path.
 * Note: Also available from sync/extractor for internal use.
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Batch an array into chunks of specified size.
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create a rate limiter that enforces a minimum delay between calls.
 */
export function createRateLimiter(minDelayMs: number) {
  let lastCallTime = 0;

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < minDelayMs) {
      await sleep(minDelayMs - timeSinceLastCall);
    }

    lastCallTime = Date.now();
    return fn();
  };
}

/**
 * Simple token bucket rate limiter.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(cost = 1): Promise<void> {
    this.refill();

    while (this.tokens < cost) {
      const waitTime = ((cost - this.tokens) / this.refillRate) * 1000;
      await sleep(waitTime);
      this.refill();
    }

    this.tokens -= cost;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

