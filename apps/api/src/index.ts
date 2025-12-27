import { createServer } from "node:http";
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
import { websocketManager } from "./lib/websocket-manager.js";
import { integrationRoutes } from "./routes/integrations/index.js";
import { createTRPCContext } from "./trpc/init.js";
import { appRouter } from "./trpc/routers/_app.js";

const app = new Hono();

app.use(secureHeaders());

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return origin; // Allow requests with no origin

      const allowedOrigins =
        process.env.ALLOWED_API_ORIGINS?.split(",")
          .map((o) => o.trim())
          .filter((o) => o.length > 0) ?? [];

      // Check exact matches first (most secure and fastest)
      if (allowedOrigins.includes(origin)) return origin;

      // Check wildcard patterns (only if explicitly configured)
      const isAllowed = allowedOrigins.some((pattern) => {
        if (pattern.includes("*")) {
          // Escape dots and replace * with .*
          const regex = new RegExp(
            `^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`,
          );
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
 * Mount integration OAuth routes.
 *
 * These are raw HTTP endpoints (not tRPC) because OAuth providers
 * redirect directly to them during the OAuth flow.
 *
 * Endpoints:
 * - GET /integrations/shopify/install - Initiate Shopify OAuth
 * - GET /integrations/shopify/callback - Handle Shopify OAuth callback
 */
app.route("/integrations", integrationRoutes);

/**
 * Lightweight health check endpoint used by hosting to confirm the API is up.
 */
app.get("/health", (c) => c.json({ status: "ok" }, 200));

/**
 * Create HTTP server for WebSocket support
 */
const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 4000;

// Create HTTP server using Node.js http module for WebSocket support
const httpServer = createServer((req, res) => {
  // Handle requests using Hono's fetch handler
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );

  // Convert Node.js headers to Headers object
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      } else {
        headers.set(key, value);
      }
    }
  }

  // Convert Node.js request body to Web Streams API for POST/PUT/PATCH
  const body =
    req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS"
      ? new ReadableStream({
          start(controller) {
            req.on("data", (chunk) => controller.enqueue(chunk));
            req.on("end", () => controller.close());
            req.on("error", (err) => controller.error(err));
          },
        })
      : undefined;

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    duplex: body ? "half" : undefined,
  } as RequestInit);

  void Promise.resolve(app.fetch(request)).then((response) => {
    // Convert headers to Node.js format, preserving multiple values
    const headerEntries: Record<string, string | string[]> = {};
    for (const [key, value] of response.headers.entries()) {
      if (headerEntries[key]) {
        // Handle duplicate headers (e.g., Set-Cookie)
        if (Array.isArray(headerEntries[key])) {
          (headerEntries[key] as string[]).push(value);
        } else {
          headerEntries[key] = [headerEntries[key] as string, value];
        }
      } else {
        headerEntries[key] = value;
      }
    }

    res.writeHead(response.status, headerEntries);

    if (response.body) {
      response.body.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(chunk);
          },
          close() {
            res.end();
          },
        }),
      );
    } else {
      res.end();
    }
  });
});

// Initialize WebSocket server
websocketManager.initialize(httpServer);

// Start server
httpServer.listen(port, () => {
  console.log(`API server listening on port ${port}`);
  console.log(`WebSocket endpoint: ws://localhost:${port}/ws/import-progress`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  websocketManager.shutdown();
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  websocketManager.shutdown();
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
