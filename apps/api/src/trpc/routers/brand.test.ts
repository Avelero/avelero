import { TRPCError } from "@trpc/server";
import { brandRouter } from "./brand";
import { createTRPCContext } from "../init";
import { hasPermission, type Permission, type Role } from "../../config/permissions";
import { deleteBrand as qDeleteBrand } from "@db/queries/brands";
import { createClient as createSupabaseJsClient, type User } from "@supabase/supabase-js";

// Mock external dependencies
jest.mock("@db/queries/brands", () => ({
  deleteBrand: jest.fn(),
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
    owner: ["brand:delete"],
    member: [],
  },
}));

describe("brandRouter.delete", () => {
  const mockBrandId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockUserId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should allow an owner to delete a brand", async () => {
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
    (qDeleteBrand as jest.Mock).mockResolvedValue({ success: true, nextBrandId: null });

    const caller = brandRouter.createCaller(mockOwnerCtx);

    await expect(caller.delete({ id: mockBrandId })).resolves.toEqual({
      success: true,
      nextBrandId: null,
    });
    expect(hasPermission).toHaveBeenCalledWith("owner", "brand:delete");
    expect(qDeleteBrand).toHaveBeenCalledWith(expect.any(Object), mockBrandId, mockUserId);
  });

  it("should prevent a member from deleting a brand", async () => {
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

    await expect(caller.delete({ id: mockBrandId })).rejects.toThrow(
      new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" })
    );
    expect(hasPermission).toHaveBeenCalledWith("member", "brand:delete");
    expect(qDeleteBrand).not.toHaveBeenCalled();
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

    await expect(caller.delete({ id: mockBrandId })).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    );
    expect(hasPermission).not.toHaveBeenCalled();
    expect(qDeleteBrand).not.toHaveBeenCalled();
  });
});
