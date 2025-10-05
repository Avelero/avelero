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
  console.error("❌ Missing required environment variables:");
  for (const varName of missingEnvVars) {
    console.error(`   - ${varName}`);
  }
  console.error("\nPlease set these environment variables and restart the server.");
  process.exit(1);
}

console.log("✅ Environment variables validated");
console.log(`🚀 Starting API server on port ${process.env.PORT || 4000}...`);

const app = new Hono();

app.use(secureHeaders());

app.use(
  "*",
  cors({
    origin: process.env.ALLOWED_API_ORIGINS?.split(",") ?? [],
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

console.log("✅ API server initialized successfully");

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 4000,
  hostname: "0.0.0.0", // Listen on all interfaces for Docker/Fly.io
  fetch: app.fetch,
};
