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
    origin: process.env.ALLOWED_API_ORIGINS?.split(",") ?? ["*"], // Allow all origins in development, or specific origins in production
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
        console.error("❌ Error creating tRPC context:", error);
        throw error;
      }
    },
    onError: ({ error, path }) => {
      console.error("❌ tRPC Error:", { path, error: error.message });
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

// Add a test endpoint for tRPC debugging
app.get("/trpc-test", (c) => {
  return c.json(
    {
      status: "tRPC endpoint accessible",
      timestamp: new Date().toISOString(),
      corsOrigins: process.env.ALLOWED_API_ORIGINS?.split(",") ?? ["*"],
    },
    200,
  );
});

// Add a database connectivity test endpoint
app.get("/db-test", async (c) => {
  try {
    // Import db here to avoid top-level import issues
    const { db } = await import("@v1/db/client");
    const result = await db.execute("SELECT 1 as test");
    return c.json({
      status: "database connected",
      timestamp: new Date().toISOString(),
      dbResponse: result.rows[0],
    });
  } catch (error) {
    console.error("Database test failed:", error);
    return c.json(
      {
        status: "database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }
});

// Add a user debug endpoint to check authentication and brand context
app.get("/user-debug", async (c) => {
  try {
    const ctx = await createTRPCContext({ req: c.req });
    return c.json({
      status: "user context retrieved",
      timestamp: new Date().toISOString(),
      hasUser: !!ctx.user,
      userId: ctx.user?.id || null,
      brandId: ctx.brandId || null,
      userEmail: ctx.user?.email || null,
      hasBrandContext: !!ctx.brandContext,
      hasUserContext: !!ctx.userContext,
    });
  } catch (error) {
    console.error("User debug failed:", error);
    return c.json(
      {
        status: "user context failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }
});

// Add a database query endpoint to check user brand status directly
app.get("/brand-debug", async (c) => {
  try {
    const ctx = await createTRPCContext({ req: c.req });
    
    if (!ctx.user) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    // Import db here to avoid top-level import issues
    const { db } = await import("@v1/db/client");
    
    // Query user's brand information
    const userResult = await db.execute(`
      SELECT id, email, brand_id, full_name 
      FROM users 
      WHERE id = $1
    `, [ctx.user.id]);
    
    // Query user's brand memberships
    const membershipResult = await db.execute(`
      SELECT brand_id, role, created_at 
      FROM users_on_brand 
      WHERE user_id = $1
    `, [ctx.user.id]);
    
    // Count products for each brand
    const productCounts = await db.execute(`
      SELECT b.id as brand_id, b.name as brand_name, COUNT(p.id) as product_count
      FROM brands b
      LEFT JOIN products p ON b.id = p.brand_id
      WHERE b.id IN (
        SELECT brand_id FROM users_on_brand WHERE user_id = $1
      )
      GROUP BY b.id, b.name
    `, [ctx.user.id]);

    return c.json({
      status: "brand debug complete",
      timestamp: new Date().toISOString(),
      userId: ctx.user.id,
      userRecord: userResult.rows[0],
      memberships: membershipResult.rows,
      brandProductCounts: productCounts.rows,
    });
  } catch (error) {
    console.error("Brand debug failed:", error);
    return c.json(
      {
        status: "brand debug failed",
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

console.log("✅ API server initialized successfully");

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,
  hostname: "0.0.0.0", // Listen on all interfaces for Docker/Fly.io
  fetch: app.fetch,
};
