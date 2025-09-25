import { TRPCError } from "@trpc/server";
import { brandRouter } from "./brand";
import { createTRPCContext } from "../init";
import { hasPermission, type Permission, type Role } from "../../config/permissions";
import { updateMemberRole as qUpdateMemberRole } from "@v1/db/queries";
import { createClient as createSupabaseJsClient, type User } from "@supabase/supabase-js";

// Mock external dependencies
jest.mock("@v1/db/queries", () => ({
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
    // Mock user as owner
    const mockOwnerCtx = {
      user: {
        id: mockUserId,
        email: "owner@example.com",
        email_confirmed_at: new Date().toISOString(),
        phone: "",
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "owner" as Role,
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User,
      brandId: mockBrandId,
      db: {} as any, // Mock db as needed
      supabase: createSupabaseJsClient("", "") as any,
      supabaseAdmin: createSupabaseJsClient("", "") as any,
      geo: {},
    };

    (hasPermission as jest.Mock).mockReturnValue(true);
    (qUpdateMemberRole as jest.Mock).mockResolvedValue({ success: true });

    const caller = brandRouter.createCaller(mockOwnerCtx);

    await expect(
      caller.updateMember({ user_id: mockTargetUserId, role: "member" })
    ).resolves.toEqual({
      success: true,
    });
    expect(hasPermission).toHaveBeenCalledWith("owner", "member:change_role");
    expect(qUpdateMemberRole).toHaveBeenCalledWith(
      expect.any(Object),
      mockUserId,
      mockBrandId,
      mockTargetUserId,
      "member"
    );
  });

  it("should prevent a member from updating another member's role", async () => {
    // Mock user as member
    const mockMemberCtx = {
      user: {
        id: mockUserId,
        email: "member@example.com",
        email_confirmed_at: new Date().toISOString(),
        phone: "",
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "member" as Role,
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User,
      brandId: mockBrandId,
      db: {} as any, // Mock db as needed
      supabase: createSupabaseJsClient("", "") as any,
      supabaseAdmin: createSupabaseJsClient("", "") as any,
      geo: {},
    };

    (hasPermission as jest.Mock).mockReturnValue(false);

    const caller = brandRouter.createCaller(mockMemberCtx);

    await expect(
      caller.updateMember({ user_id: mockTargetUserId, role: "owner" })
    ).rejects.toThrow(
      new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" })
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
      supabaseAdmin: createSupabaseJsClient("", "") as any,
      geo: {},
    };

    const caller = brandRouter.createCaller(mockUnauthCtx);

    await expect(
      caller.updateMember({ user_id: mockTargetUserId, role: "member" })
    ).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    );
    expect(hasPermission).not.toHaveBeenCalled();
    expect(qUpdateMemberRole).not.toHaveBeenCalled();
  });
});