import { TRPCError } from "@trpc/server";
import { brandRouter } from "./brand";
import { createTRPCContext } from "../init";
import { hasPermission, type Permission, type Role } from "../../config/permissions";
import { deleteBrand as qDeleteBrand, updateBrand as qUpdateBrand, getBrandsByUserId as listBrandsForUser } from "@db/queries/brands";
import { createClient as createSupabaseJsClient, type User } from "@supabase/supabase-js";
import { ROLES } from "../../config/roles";
import type { Database as DrizzleDatabase } from "@v1/db/client";

// Mock external dependencies
const mockDeleteBrand = jest.fn();
const mockUpdateBrand = jest.fn();
const mockListBrandsForUser = jest.fn();

jest.mock("@db/queries/brands", () => ({
  deleteBrand: mockDeleteBrand,
  updateBrand: mockUpdateBrand,
  getBrandsByUserId: mockListBrandsForUser,
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


const mockDb = {} as DrizzleDatabase;
const mockSupabase = createSupabaseJsClient("", "");
const mockSupabaseAdmin = createSupabaseJsClient("", "");

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
        role: ROLES.OWNER,
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      brandId: mockBrandId,
      db: {}, // Mock db as needed
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: {
        storage: {
          from: jest.fn(() => ({
            list: jest.fn(() => Promise.resolve({ data: [], error: null })),
            remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        },
      },
      geo: {},
    };


    mockDeleteBrand.mockResolvedValue({ success: true, nextBrandId: null });

    const caller = brandRouter.createCaller(mockOwnerCtx);

    await expect(caller.delete({ id: mockBrandId })).resolves.toEqual({
      success: true,
      nextBrandId: null,
    });
    expect(hasPermission).toHaveBeenCalledWith(ROLES.OWNER, "brand:delete");
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
        role: ROLES.MEMBER,
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      brandId: mockBrandId,
      db: {}, // Mock db as needed
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: createSupabaseJsClient("", ""),
      geo: {},
    };

    await expect(caller.delete({ id: mockBrandId })).rejects.toThrow(
      new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have the required role to access this resource.",
      }),
    );
    expect(qDeleteBrand).not.toHaveBeenCalled();
  });

  it("should throw UNAUTHORIZED if user is not authenticated", async () => {
    const mockUnauthCtx = {
      user: null,
      brandId: mockBrandId,
      db: {}, // Mock db as needed
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: createSupabaseJsClient("", ""),
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

describe("brandRouter.update", () => {
  const mockBrandId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockUserId = "test-user-id";
  const mockUpdateInput = {
    id: mockBrandId,
    name: "Updated Brand Name",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should allow an owner to update a brand", async () => {
    const mockOwnerCtx = {
      user: {
        id: mockUserId,
        email: "owner@example.com",
        email_confirmed_at: new Date().toISOString(),
        phone: "",
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: ROLES.OWNER,
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      brandId: mockBrandId,
      db: {},
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: createSupabaseJsClient("", ""),
      geo: {},
    };

    mockUpdateBrand.mockResolvedValue({ success: true });

    const caller = brandRouter.createCaller(mockOwnerCtx);

    await expect(caller.update(mockUpdateInput)).resolves.toEqual({
      success: true,
    });
    expect(qUpdateBrand).toHaveBeenCalledWith(
      expect.any(Object),
      mockUserId,
      mockUpdateInput,
    );
  });

  it("should prevent a member from updating a brand", async () => {
    const mockMemberCtx = {
      user: {
        id: mockUserId,
        email: "member@example.com",
        email_confirmed_at: new Date().toISOString(),
        phone: "",
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: ROLES.MEMBER,
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      brandId: mockBrandId,
      db: {},
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: createSupabaseJsClient("", ""),
      geo: {},
    };

    const caller = brandRouter.createCaller(mockMemberCtx);

    await expect(caller.update(mockUpdateInput)).rejects.toThrow(
      new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have the required role to access this resource.",
      }),
    );
    expect(qUpdateBrand).not.toHaveBeenCalled();
  });

  it("should throw UNAUTHORIZED if user is not authenticated", async () => {
    const mockUnauthCtx = {
      user: null,
      brandId: mockBrandId,
      db: {},
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: createSupabaseJsClient("", ""),
      geo: {},
    };

    const caller = brandRouter.createCaller(mockUnauthCtx);

    await expect(caller.update(mockUpdateInput)).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" }),
    );
    expect(qUpdateBrand).not.toHaveBeenCalled();
  });
});

describe("brandRouter.list", () => {
  const mockBrandId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockUserId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should allow a member to list brands", async () => {
    const mockMemberCtx = {
      user: {
        id: mockUserId,
        email: "member@example.com",
        email_confirmed_at: new Date().toISOString(),
        phone: "",
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: ROLES.MEMBER,
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      brandId: mockBrandId,
      db: {}, // Mock db as needed
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: createSupabaseJsClient("", ""),
      geo: {},
    };

    mockListBrandsForUser.mockResolvedValue([{ id: mockBrandId, name: "Test Brand" }]);

    const caller = brandRouter.createCaller(mockMemberCtx);

    await expect(caller.list()).resolves.toEqual({
      data: [{ id: mockBrandId, name: "Test Brand" }],
    });
    expect(listBrandsForUser).toHaveBeenCalledWith(expect.any(Object), mockUserId);
  });

  it("should throw UNAUTHORIZED if user is not authenticated", async () => {
    const mockUnauthCtx = {
      user: null,
      brandId: mockBrandId,
      db: {}, // Mock db as needed
      supabase: createSupabaseJsClient("", ""),
      supabaseAdmin: createSupabaseJsClient("", ""),
      geo: {},
    };

    const caller = brandRouter.createCaller(mockUnauthCtx);

    await expect(caller.list()).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    );
    expect(listBrandsForUser).not.toHaveBeenCalled();
  });
});