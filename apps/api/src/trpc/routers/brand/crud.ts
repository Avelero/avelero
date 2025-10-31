/**
 * Brand CRUD operations router.
 *
 * Handles basic brand lifecycle: creation, updates, deletion, and listing.
 */
import {
  getBrandsByUserId as listBrandsForUser,
  createBrand as qCreateBrand,
  deleteBrand as qDeleteBrand,
  setActiveBrand as qSetActiveBrand,
  updateBrand as qUpdateBrand,
} from "@v1/db/queries";
import { ROLES } from "../../../config/roles.js";
import {
  brandIdParamSchema,
  createBrandSchema,
  listBrandsSchema,
  updateBrandSchema,
} from "../../../schemas/index.js";
import { createListResponse } from "../../../utils/response.js";
import { createTRPCRouter, protectedProcedure } from "../../init.js";
import { hasRole } from "@api/trpc/middleware/auth/roles.js";

/**
 * Router exposing brand CRUD operations.
 */
export const brandCrudRouter = createTRPCRouter({
  /**
   * Lists all brands the current user belongs to and their roles.
   *
   * Supports field selection to reduce data transfer when only specific
   * fields are needed (e.g., id and name for dropdowns).
   *
   * @param input - Optional field selection.
   * @returns Array of brand records with membership metadata.
   */
  list: protectedProcedure
    .input(listBrandsSchema.optional())
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;
      const data = await listBrandsForUser(db, user.id, {
        fields: input?.fields,
      });
      return createListResponse(data);
    }),

  /**
   * Creates a brand owned by the current user.
   *
   * @param input - New brand details.
   * @returns Created brand record.
   */
  create: protectedProcedure
    .input(createBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Default email to user's email if not provided
      const brandData = {
        ...input,
        email: input.email ?? user.email,
      };

      return qCreateBrand(db, user.id, brandData);
    }),

  /**
   * Updates a brand's profile. Restricted to brand owners.
   *
   * @param input - Brand identifier and fields to change.
   * @returns Updated brand record.
   */
  update: protectedProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(updateBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      const payload: Parameters<typeof qUpdateBrand>[2] = { id: input.id };
      if (input.name !== undefined) {
        payload.name = input.name;
      }
      if (input.email !== undefined) {
        payload.email = input.email;
      }
      if (input.country_code !== undefined) {
        payload.country_code = input.country_code;
      }
      if (input.logo_path !== undefined) {
        payload.logo_path = input.logo_path;
      }
      if (input.avatar_hue !== undefined) {
        payload.avatar_hue = input.avatar_hue;
      }
      return qUpdateBrand(db, user.id, payload);
    }),

  /**
   * Deletes a brand and cleans up associated storage assets.
   *
   * @param input - Brand identifier.
   * @returns Result of the deletion including the next active brand.
   */
  delete: protectedProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(brandIdParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, supabaseAdmin } = ctx;
      // Delete brand storage folder before deleting brand
      if (supabaseAdmin) {
        const { data: files } = await supabaseAdmin.storage
          .from("brand-avatars")
          .list(input.id);

        if (files && files.length > 0) {
          const filePaths = files.map((file) => `${input.id}/${file.name}`);
          await supabaseAdmin.storage.from("brand-avatars").remove(filePaths);
        }
      }

      // Delete brand and get next active brand
      const result = await qDeleteBrand(db, input.id, user.id);
      return result;
    }),

  /**
   * Sets the active brand for the current user session.
   *
   * @param input - Brand identifier to activate.
   * @returns Updated active brand record.
   */
  setActive: protectedProcedure
    .input(brandIdParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      return qSetActiveBrand(db, user.id, input.id);
    }),
});
