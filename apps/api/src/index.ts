import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { appRouter } from "./trpc/routers/_app.js";
import { createTRPCContext } from "./trpc/init.js";

const app = new Hono();

app.use(secureHeaders());

app.use(
  "*",
  cors({
    origin: process.env.ALLOWED_API_ORIGINS?.split(",") ?? ["*"],
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
    createContext: createTRPCContext as any,
  }),
);

app.get("/health", (c: any) => c.json({ status: "ok" }, 200));

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 4000,
  fetch: app.fetch,
};


