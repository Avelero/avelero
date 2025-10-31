/**
 * Bootstraps the public API server supporting the tRPC endpoints.
 *
 * This module wires together the Hono web server, shared middleware, and the
 * tRPC router that exposes the brand and product management endpoints. Bun
 * loads this file directly in both development and production.
 */
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createTRPCContext } from "./trpc/init.js";
import { appRouter } from "./trpc/routers/_app.js";

const app = new Hono();

app.use(secureHeaders());

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return origin; // Allow requests with no origin
      
      const allowedOrigins = process.env.ALLOWED_API_ORIGINS?.split(",") ?? [];
      
      // Check exact matches first (most secure and fastest)
      if (allowedOrigins.includes(origin)) return origin;
      
      // Check wildcard patterns (only if explicitly configured)
      const isAllowed = allowedOrigins.some(pattern => {
        if (pattern.includes('*')) {
          // Escape dots and replace * with .*
          const regex = new RegExp(`^${pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
          return regex.test(origin);
        }
        return false;
      });
      
      return isAllowed ? origin : undefined;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "accept-language",
      "x-trpc-source",
      "x-user-locale",
      "x-user-timezone",
      "x-user-country",
    ],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  }),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: async (opts) => {
      const ctx = await createTRPCContext({ req: opts.req });
      return ctx as unknown as Record<string, unknown>;
    },
  }),
);

/**
 * Lightweight health check endpoint used by hosting to confirm the API is up.
 */
app.get("/health", (c) => c.json({ status: "ok" }, 200));

/**
 * Bun-compatible server export consumed by the runtime.
 *
 * @returns Object including the listen port and fetch handler.
 */
const serverConfig = {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 4000,
  fetch: app.fetch,
};

export default serverConfig;
