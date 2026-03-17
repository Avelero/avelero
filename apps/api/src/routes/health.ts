import { Hono } from "hono";
import { db } from "@v1/db/client";
import { sql } from "@v1/db/queries";
import { billingLogger } from "@v1/logger/billing";
import { getStripeClient } from "../lib/stripe/client.js";

const log = billingLogger.child({ component: "health" });

export const healthRouter = new Hono();

healthRouter.get("/", async (c) => {
  const checks: Record<
    string,
    { status: "ok" | "degraded" | "down"; latencyMs: number }
  > = {};

  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: "down", latencyMs: Date.now() - dbStart };
  }

  const stripeStart = Date.now();
  try {
    const stripe = getStripeClient();
    await stripe.balance.retrieve();
    checks.stripe = { status: "ok", latencyMs: Date.now() - stripeStart };
  } catch {
    checks.stripe = { status: "degraded", latencyMs: Date.now() - stripeStart };
  }

  const overallStatus = Object.values(checks).some((c) => c.status === "down")
    ? "down"
    : Object.values(checks).some((c) => c.status === "degraded")
      ? "degraded"
      : "ok";

  const httpStatus = overallStatus === "down" ? 503 : 200;

  if (overallStatus !== "ok") {
    log.warn({ checks, overallStatus }, "health check degraded");
  }

  return c.json({ status: overallStatus, checks }, httpStatus);
});
