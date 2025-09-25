import { TRPCError } from "@trpc/server";
import { brandRouter } from "./brand";
import { createTRPCContext } from "../init";
import { hasPermission, type Permission, type Role } from "../../config/permissions";
import { updateMemberRole as qUpdateMemberRole } from "@v1/db/queries";
import { createClient as createSupabaseJsClient, type User } from "@supabase/supabase-js";
import { ROLES } from "../../config/roles";
import type { Database as DrizzleDatabase } from "@v1/db/client";

// Mock external dependencies
const mockUpdateMemberRole = jest.fn();
const mockHasPermission = jest.fn();

jest.mock("@v1/db/queries", () => ({
  updateMemberRole: mockUpdateMemberRole,
}));

jest.mock("../../config/permissions", () => ({
  hasPermission: mockHasPermission,
}));

const mockDb = {} as DrizzleDatabase;
const mockSupabase = createSupabaseJsClient("", "");
const mockSupabaseAdmin = createSupabaseJsClient("", "");
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
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      brandId: mockBrandId,
      role: ROLES.OWNER,
      db: mockDb,
      supabase: mockSupabase,
      supabaseAdmin: mockSupabaseAdmin,
      geo: {},
    };

    hasPermission.mockReturnValue(true);
    mockUpdateMemberRole.mockResolvedValue({ success: true });

    const caller = brandRouter.createCaller(mockOwnerCtx);

    await expect(
      caller.updateMember({ user_id: mockTargetUserId, role: ROLES.MEMBER })
    ).resolves.toEqual({
      success: true,
    });
    expect(hasPermission).toHaveBeenCalledWith(ROLES.OWNER, "member:change_role");
    expect(mockUpdateMemberRole).toHaveBeenCalledWith(
      expect.any(Object),
      mockUserId,
      mockBrandId,
      mockTargetUserId,
      ROLES.MEMBER
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
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      brandId: mockBrandId,
      role: ROLES.MEMBER,
      db: mockDb,
      supabase: mockSupabase,
      supabaseAdmin: mockSupabaseAdmin,
      geo: {},
    };

    hasPermission.mockReturnValue(false);

    const caller = brandRouter.createCaller(mockMemberCtx);

    await expect(
      caller.updateMember({ user_id: mockTargetUserId, role: ROLES.OWNER })
    ).rejects.toThrow(
      new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" })
    );
    expect(hasPermission).toHaveBeenCalledWith(ROLES.MEMBER, "member:change_role");
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });

  it("should throw UNAUTHORIZED if user is not authenticated", async () => {
    const mockUnauthCtx = {
      user: null,
      brandId: mockBrandId,
      role: null,
      db: mockDb,
      supabase: mockSupabase,
      supabaseAdmin: mockSupabaseAdmin,
      geo: {},
    };

    const caller = brandRouter.createCaller(mockUnauthCtx);

    await expect(
      caller.updateMember({ user_id: mockTargetUserId, role: ROLES.MEMBER })
    ).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    );
    expect(hasPermission).not.toHaveBeenCalled();
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });
});
