import "server-only";
import { setupAnalytics } from "@v1/analytics/server";
import { ratelimit } from "@v1/kv/ratelimit";
import { logger } from "@v1/logger";
import { getUser } from "@v1/supabase/queries";
import { createClient } from "@v1/supabase/server";
import {
  DEFAULT_SERVER_ERROR_MESSAGE,
  createSafeActionClient,
} from "next-safe-action";
import { headers } from "next/headers";
import { z } from "zod";

const handleServerError = (e: Error) => {
  // Don't catch Next.js redirect errors - let them bubble up
  if (
    e.message === "NEXT_REDIRECT" ||
    (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")
  ) {
    throw e;
  }

  // Also log with our logger for development
  logger.error(`Action error: ${e.message}`);

  if (e instanceof Error) {
    return e.message;
  }

  return DEFAULT_SERVER_ERROR_MESSAGE;
};

export const actionClient = createSafeActionClient({
  handleServerError,
});

export const actionClientWithMeta = createSafeActionClient({
  handleServerError,
  defineMetadataSchema() {
    return z.object({
      name: z.string(),
      track: z
        .object({
          event: z.string(),
          channel: z.string(),
        })
        .optional(),
    });
  },
});

export const authActionClient = actionClientWithMeta
  .use(async ({ next, clientInput, metadata }) => {
    const result = await next({ ctx: {} });

    if (process.env.NODE_ENV === "development") {
      logger.info(`Input -> ${JSON.stringify(clientInput)}`);
      logger.info(`Result -> ${JSON.stringify(result.data)}`);
      logger.info(`Metadata -> ${JSON.stringify(metadata)}`);

      return result;
    }

    return result;
  })
  .use(async ({ next, metadata }) => {
    const ip = (await headers()).get("x-forwarded-for");

    logger.info("[auth-middleware] Starting ratelimit check", {
      ip,
      action: metadata.name,
    });

    try {
      const { success, remaining } = await ratelimit.limit(
        `${ip}-${metadata.name}`,
      );

      logger.info("[auth-middleware] Ratelimit check completed", {
        success,
        remaining,
      });

      if (!success) {
        throw new Error("Too many requests");
      }

      return next({
        ctx: {
          ratelimit: {
            remaining,
          },
        },
      });
    } catch (error) {
      logger.error("[auth-middleware] Ratelimit check failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  })
  .use(async ({ next, metadata }) => {
    logger.info("[auth-middleware] Getting user");

    try {
      const {
        data: { user },
      } = await getUser();

      logger.info("[auth-middleware] Got user", { userId: user?.id });

      const supabase = await createClient();

      if (!user) {
        throw new Error("Unauthorized");
      }

      if (metadata) {
        const analytics = await setupAnalytics({
          userId: user.id,
        });

        if (metadata.track) {
          analytics.track(metadata.track);
        }
      }

      return next({
        ctx: {
          supabase,
          user,
        },
      });
    } catch (error) {
      logger.error("[auth-middleware] Auth check failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  });
