import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createTRPCContext } from "./trpc/init.js";
import { appRouter } from "./trpc/routers/_app.js";

// Validate required environment variables at startup
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:");
  for (const varName of missingEnvVars) {
    console.error(`   - ${varName}`);
  }
  console.error("\nPlease set these environment variables and restart the server.");
  process.exit(1);
}

console.log("Environment variables validated");
console.log(`Starting API server on port ${process.env.PORT || 4000}...`);

const app = new Hono();

app.use(secureHeaders());

app.use(
  "*",
  cors({
  origin: process.env.ALLOWED_API_ORIGINS?.split(",") ?? ["http://localhost:3000"], // Safer default: only allow local dev origin when ALLOWED_API_ORIGINS is unset
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
    credentials: true, // Allow credentials for authentication
  }),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: async (opts) => {
      try {
        const ctx = await createTRPCContext({ req: opts.req });
        return ctx as unknown as Record<string, unknown>;
      } catch (error) {
  console.error("Error creating tRPC context:", error);
        throw error;
      }
    },
    onError: ({ error, path }) => {
  console.error("tRPC Error:", { path, error: error.message });
    },
  }),
);

app.get("/health", (c) => {
  return c.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
    200,
  );
});

// TODO: DEBUG ENDPOINTS - remove these before deploying to production.
// These endpoints expose internal system information and user data (e.g. /auth-debug exposes user emails and IDs).
// They are intended for local development only.
// Add a test endpoint for tRPC debugging
app.get("/trpc-test", (c) => {
  return c.json(
    {
      status: "tRPC endpoint accessible",
      timestamp: new Date().toISOString(),
      corsOrigins: process.env.ALLOWED_API_ORIGINS?.split(",") ?? ["http://localhost:3000"],
    },
    200,
  );
});

// Add a database connectivity test endpoint
app.get("/db-test", async (c) => {
  try {
    // Import db here to avoid top-level import issues
    const { db } = await import("@v1/db/client");
    const { sql } = await import("drizzle-orm");
    
    // Simple database connectivity test
    const result = await db.execute(sql`SELECT 1 as test, NOW() as timestamp`);
    
    return c.json(
      {
        status: "database connected",
        timestamp: new Date().toISOString(),
        dbResponse: result[0],
        environment: process.env.NODE_ENV || "development",
      },
      200,
    );
  } catch (error) {
  console.error("Database connection error:", error);
    return c.json(
      {
        status: "database connection failed",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        environment: process.env.NODE_ENV || "development",
      },
      500,
    );
  }
});

// Add auth debug endpoint to check authentication flow
app.get("/auth-debug", async (c) => {
  try {
    const ctx = await createTRPCContext({ req: c.req as unknown as Request });
    
    return c.json({
      status: "auth debug complete",
      timestamp: new Date().toISOString(),
      hasUser: !!ctx.user,
      userId: ctx.user?.id || null,
      userEmail: ctx.user?.email || null,
      brandId: ctx.brandId || null,
      hasBrandContext: !!ctx.brandContext,
      headers: {
        authorization: c.req.header("authorization") || null,
        origin: c.req.header("origin") || null,
      },
    });
  } catch (error) {
    console.error("Auth debug failed:", error);
    return c.json(
      {
        status: "auth debug failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }
});

app.get("/", (c) => {
  return c.json(
    {
      name: "Avelero API",
      version: "1.0.0",
      status: "running",
      endpoints: {
        health: "/health",
        trpc: "/trpc",
      },
    },
    200,
  );
});

console.log("API server initialized successfully");

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,
  hostname: "0.0.0.0", // Listen on all interfaces for Docker/Fly.io
  fetch: app.fetch,
};
