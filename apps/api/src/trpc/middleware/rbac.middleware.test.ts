import { TRPCError } from "@trpc/server";
import { hasRole } from "./rbac.middleware";
import { protectedProcedure } from "../init";

describe("hasRole middleware", () => {
  it("should allow access if user has an allowed role", async () => {
    const next = jest.fn();
    const ctx = {
      user: { id: "123", email: "test@example.com", role: "owner" },
      db: {}, // Mock db if needed
    };

    const middleware = hasRole(["owner"]);
    await expect(middleware._def.fn({ ctx, next, rawInput: undefined, path: "" })).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("should throw FORBIDDEN error if user does not have an allowed role", async () => {
    const next = jest.fn();
    const ctx = {
      user: { id: "123", email: "test@example.com", role: "member" },
      db: {}, // Mock db if needed
    };

    const middleware = hasRole(["owner"]);
    await expect(middleware._def.fn({ ctx, next, rawInput: undefined, path: "" })).rejects.toThrow(TRPCError);
    await expect(middleware._def.fn({ ctx, next, rawInput: undefined, path: "" })).rejects.toHaveProperty("code", "FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("should throw FORBIDDEN error if no user in context", async () => {
    const next = jest.fn();
    const ctx = {
      user: null,
      db: {}, // Mock db if needed
    };

    const middleware = hasRole(["owner"]);
    await expect(middleware._def.fn({ ctx, next, rawInput: undefined, path: "" })).rejects.toThrow(TRPCError);
    await expect(middleware._def.fn({ ctx, next, rawInput: undefined, path: "" })).rejects.toHaveProperty("code", "FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });
});