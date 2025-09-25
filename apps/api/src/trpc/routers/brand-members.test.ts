import { TRPCError } from "@trpc/server";
import { brandRouter } from "./brand";
import { hasPermission, Permission, Role } from "../../config/permissions";
import { updateMemberRole as qUpdateMemberRole } from "@db/queries/brand-members";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

// Mock external dependencies
jest.mock("@db/queries/brand-members", () => ({
  updateMemberRole: jest.fn(),
}));
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null } }))
    },
    storage: {
      from: jest.fn(() => ({
        list: jest.fn(() => Promise.resolve({ data: [], error: null })),
        remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    },
  })),
}));
jest.mock("../../config/permissions", () => ({
  hasPermission: jest.fn(),
  PERMISSIONS: {
    owner: ["member:change_role"],
    member: [],
  },
}));

describe("brandRouter.updateMember", () => {
  const mockBrandId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockUserId = "test-user-id";
  const mockTargetUserId = "target-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should allow an owner to update a member's role", async () => {
    const mockOwnerCtx = {
      user: { id: mockUserId, role: "owner" as Role },
      brandId: mockBrandId,
      db: {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve()),
          })),
        })),
      } as any, // Mock db as needed
      supabase: createSupabaseJsClient("", "") as any,
      supabaseAdmin: {
        storage: {
          from: jest.fn(() => ({
            list: jest.fn(() => Promise.resolve({ data: [], error: null })),
            remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        },
      } as any,
      geo: {},
    };

    (hasPermission as jest.Mock).mockReturnValue(true);
    (qUpdateMemberRole as jest.Mock).mockResolvedValue({ success: true });

    const caller = brandRouter.createCaller(mockOwnerCtx);

    try {
      await caller.updateMember({
        user_id: mockTargetUserId,
        role: "member",
      });
      expect(true).toBe(false); // Should not reach here if it rejects
    } catch (error) {
      console.error("Rejection error:", error);
      expect(false).toBe(true); // Should not reach here if it resolves
    }

    // Original assertions (will be re-enabled after debugging)
    // await expect(
    //   caller.updateMember({
    //     user_id: mockTargetUserId,
    //     role: "member",
    //   }),
    // ).resolves.toEqual({ success: true });
    expect(hasPermission).toHaveBeenCalledWith("owner", "member:change_role");
    expect(qUpdateMemberRole).toHaveBeenCalledWith(
      expect.any(Object),
      mockUserId,
      mockBrandId,
      mockTargetUserId,
      "member",
    );
  });

  it("should prevent a member from updating another member's role", async () => {
    // Mock user as member
    const mockMemberCtx = {
      user: { id: mockUserId, role: "member" as Role },
      brandId: mockBrandId,
      db: {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve()),
          })),
        })),
      } as any, // Mock db as needed
      supabase: createSupabaseJsClient("", "") as any,
      supabaseAdmin: {
        storage: {
          from: jest.fn(() => ({
            list: jest.fn(() => Promise.resolve({ data: [], error: null })),
            remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        },
      } as any,
      geo: {},
    };

    (hasPermission as jest.Mock).mockReturnValue(false);

    const caller = brandRouter.createCaller(mockMemberCtx);

    await expect(
      caller.updateMember({
        user_id: mockTargetUserId,
        role: "member",
      }),
    ).rejects.toThrow(
      new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" }),
    );
    expect(hasPermission).toHaveBeenCalledWith("member", "member:change_role");
    expect(qUpdateMemberRole).not.toHaveBeenCalled();
  });

  it("should throw UNAUTHORIZED if user is not authenticated", async () => {
    const mockUnauthCtx = {
      user: null,
      brandId: mockBrandId,
      db: {} as any,
      supabase: createSupabaseJsClient("", "") as any,
      supabaseAdmin: {
        storage: {
          from: jest.fn(() => ({
            list: jest.fn(() => Promise.resolve({ data: [], error: null })),
            remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        },
      } as any,
      geo: {},
    };

    const caller = brandRouter.createCaller(mockUnauthCtx);

    await expect(
      caller.updateMember({
        user_id: mockTargetUserId,
        role: "member",
      }),
    ).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" }),
    );
    expect(hasPermission).not.toHaveBeenCalled();
    expect(qUpdateMemberRole).not.toHaveBeenCalled();
  });
});
