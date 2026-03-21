/**
 * Reusable API server construction and lifecycle helpers.
 *
 * This module centralizes Hono app wiring and HTTP server lifecycle so local
 * development, production entrypoints, and live Stripe tests can boot the same
 * runtime without duplicating startup logic.
 */
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { billingLogger } from "@v1/logger/billing";
import { assertPriceIdsConfigured } from "./lib/stripe/config.js";
import { websocketManager } from "./lib/websocket-manager.js";
import { healthRouter } from "./routes/health.js";
import { integrationRoutes } from "./routes/integrations/index.js";
import { webhookRoutes } from "./routes/webhooks/index.js";
import { createTRPCContext } from "./trpc/init.js";
import { appRouter } from "./trpc/routers/_app.js";

const log = billingLogger.child({ component: "api-server" });

export interface ApiServerHandle {
  app: Hono;
  httpServer: HttpServer;
  port: number;
  close: () => Promise<void>;
}

/**
 * Validates Stripe billing configuration without crashing local non-prod boots.
 */
function assertStripeBillingConfiguration(): void {
  try {
    assertPriceIdsConfigured();
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
    log.warn(
      { err },
      "Stripe price IDs not fully configured — billing routes will fail at call time",
    );
  }
}

/**
 * Resolves whether a request origin should be echoed back by CORS.
 */
function resolveCorsOrigin(origin?: string | null): string | undefined {
  if (!origin) return origin ?? undefined;

  const allowedOrigins =
    process.env.ALLOWED_API_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? [];

  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  const isAllowed = allowedOrigins.some((pattern) => {
    if (!pattern.includes("*")) {
      return false;
    }

    const regex = new RegExp(
      `^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`,
    );
    return regex.test(origin);
  });

  return isAllowed ? origin : undefined;
}

/**
 * Converts a Node.js request into a Fetch API Request for Hono.
 */
function createFetchRequest(req: IncomingMessage): Request {
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    headers.set(key, value);
  }

  const body =
    req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS"
      ? new ReadableStream({
          // Stream the Node request body into the Fetch request Hono expects.
          start(controller) {
            req.on("data", (chunk: Buffer) => controller.enqueue(chunk));
            req.on("end", () => controller.close());
            req.on("error", (error: Error) => controller.error(error));
          },
        })
      : undefined;

  return new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    duplex: body ? "half" : undefined,
  } as RequestInit);
}

/**
 * Writes a Fetch API response back onto a Node.js HTTP response.
 */
async function writeNodeResponse(
  response: Response,
  res: ServerResponse<IncomingMessage>,
): Promise<void> {
  const headerEntries: Record<string, string | string[]> = {};

  for (const [key, value] of response.headers.entries()) {
    if (headerEntries[key]) {
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

  if (!response.body) {
    res.end();
    return;
  }

  await response.body.pipeTo(
    new WritableStream({
      write(chunk) {
        res.write(chunk);
      },
      close() {
        res.end();
      },
      abort() {
        res.destroy();
      },
    }),
  );
}

/**
 * Builds the shared Hono application used by all API entrypoints.
 */
export function createApiApp(): Hono {
  assertStripeBillingConfiguration();

  const app = new Hono();

  app.use(secureHeaders());

  app.use(
    "*",
    cors({
      origin: (origin) => resolveCorsOrigin(origin),
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

  app.route("/integrations", integrationRoutes);
  app.route("/webhooks", webhookRoutes);
  app.route("/health", healthRouter);

  return app;
}

/**
 * Creates the Node.js HTTP server wrapper needed for WebSocket support.
 */
export function createApiHttpServer(app: Hono): HttpServer {
  const httpServer = createServer((req, res) => {
    const request = createFetchRequest(req);

    void Promise.resolve(app.fetch(request)).then(
      async (response) => {
        await writeNodeResponse(response, res);
      },
      (error) => {
        log.error({ err: error }, "failed to handle API request");
        res.statusCode = 500;
        res.end("Internal Server Error");
      },
    );
  });

  websocketManager.initialize(httpServer);
  return httpServer;
}

/**
 * Starts the API HTTP server and returns a reusable close handle.
 */
export async function startApiServer(opts?: {
  port?: number;
  host?: string;
  logStartup?: boolean;
}): Promise<ApiServerHandle> {
  const app = createApiApp();
  const httpServer = createApiHttpServer(app);
  const requestedPort = opts?.port ?? Number.parseInt(process.env.PORT ?? "4000");
  const host = opts?.host;
  const shouldLogStartup = opts?.logStartup ?? true;

  await new Promise<void>((resolve, reject) => {
    // Start listening before tests or production traffic begin using the API.
    httpServer.listen(requestedPort, host, () => resolve());
    httpServer.once("error", reject);
  });

  const address = httpServer.address();
  const port =
    typeof address === "object" && address !== null
      ? address.port
      : requestedPort;
  let closed = false;

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    websocketManager.shutdown();

    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  if (shouldLogStartup) {
    console.log(`API server listening on port ${port}`);
    console.log(`WebSocket endpoint: ws://localhost:${port}/ws/import-progress`);
  }

  return {
    app,
    httpServer,
    port,
    close,
  };
}

/**
 * Installs process signal handlers that gracefully stop the API server.
 */
export function installApiServerShutdown(server: ApiServerHandle): void {
  const shutdown = async (signal: "SIGTERM" | "SIGINT") => {
    console.log(`${signal} signal received: closing HTTP server`);
    try {
      await server.close();
      console.log("HTTP server closed");
      process.exit(0);
    } catch (error) {
      console.error("Failed to close HTTP server", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}
