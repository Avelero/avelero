/**
 * Unit tests for the Node.js API server bridge.
 */
import "../setup-env";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import { Hono } from "hono";
import { createApiHttpServer } from "../../src/server";

describe("createApiHttpServer", () => {
  let httpServer: Server | null = null;
  let baseUrl = "";
  const originalMaxBodyBytes = process.env.API_MAX_REQUEST_BODY_BYTES;

  beforeEach(async () => {
    // Start a minimal Hono app behind the Node bridge with a tiny request limit.
    process.env.API_MAX_REQUEST_BODY_BYTES = "64";

    const app = new Hono();
    app.post("/", async (ctx) => {
      // Echo the request body so the test can verify the bridge preserves valid payloads.
      return ctx.text(await ctx.req.text());
    });

    httpServer = createApiHttpServer(app);
    await new Promise<void>((resolve) => {
      httpServer!.listen(0, "127.0.0.1", () => resolve());
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve the test server port.");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    // Close the server and restore the environment override between tests.
    process.env.API_MAX_REQUEST_BODY_BYTES = originalMaxBodyBytes;

    if (!httpServer) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      httpServer!.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    httpServer = null;
    baseUrl = "";
  });

  it("returns 413 when the request body exceeds the configured limit", async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: "POST",
      body: "x".repeat(65),
    });

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("Payload Too Large");
  });

  it("passes smaller request bodies through to the Hono app", async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: "POST",
      body: "x".repeat(32),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("x".repeat(32));
  });
});
