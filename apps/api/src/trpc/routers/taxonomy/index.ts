/**
 * Taxonomy router for global, read-only reference data.
 *
 * Exposes taxonomy attributes and values that serve as defaults and semantic
 * anchors for brand-specific attributes. UI can use these for discovery,
 * while brand attributes/values are what actually get assigned to variants.
 *
 * All endpoints are read-only - taxonomy data is managed via database migrations
 * or admin scripts, not through the API.
 */
import {
  getTaxonomyAttributeByFriendlyId,
  getTaxonomyValueByFriendlyId,
  listTaxonomyAttributes,
  listTaxonomyValues,
  listTaxonomyValuesByAttribute,
} from "@v1/db/queries/taxonomy";
import { z } from "zod";
import { wrapError } from "../../../utils/errors.js";
import { createTRPCRouter, protectedProcedure } from "../../init.js";

export const taxonomyRouter = createTRPCRouter({
  /**
   * Taxonomy attributes endpoints.
   *
   * Attributes are the dimension types (e.g., "Color", "Size", "Material").
   */
  attributes: createTRPCRouter({
    /**
     * Lists all taxonomy attributes.
     *
     * Returns the global catalog of available attribute types that brands
     * can link to when creating their own attributes.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listTaxonomyAttributes(ctx.db);
      } catch (error) {
        throw wrapError(error, "Failed to list taxonomy attributes");
      }
    }),

    /**
     * Gets a taxonomy attribute by its friendly ID.
     *
     * @param friendly_id - URL-friendly identifier (e.g., "color", "size")
     */
    getByFriendlyId: protectedProcedure
      .input(z.object({ friendly_id: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        try {
          return await getTaxonomyAttributeByFriendlyId(
            ctx.db,
            input.friendly_id,
          );
        } catch (error) {
          throw wrapError(error, "Failed to get taxonomy attribute");
        }
      }),
  }),

  /**
   * Taxonomy values endpoints.
   *
   * Values are the options within a dimension (e.g., "Red", "Blue" for Color).
   */
  values: createTRPCRouter({
    /**
     * Lists all taxonomy values.
     *
     * Returns the complete list of values across all attributes.
     * For attribute-specific values, use listByAttribute instead.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listTaxonomyValues(ctx.db);
      } catch (error) {
        throw wrapError(error, "Failed to list taxonomy values");
      }
    }),

    /**
     * Lists taxonomy values for a specific attribute.
     *
     * @param attribute_friendly_id - The attribute's friendly ID (e.g., "color")
     */
    listByAttribute: protectedProcedure
      .input(z.object({ attribute_friendly_id: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        try {
          return await listTaxonomyValuesByAttribute(
            ctx.db,
            input.attribute_friendly_id,
          );
        } catch (error) {
          throw wrapError(error, "Failed to list taxonomy values by attribute");
        }
      }),

    /**
     * Gets a taxonomy value by its friendly ID.
     *
     * @param friendly_id - URL-friendly identifier (e.g., "color-red")
     */
    getByFriendlyId: protectedProcedure
      .input(z.object({ friendly_id: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        try {
          return await getTaxonomyValueByFriendlyId(ctx.db, input.friendly_id);
        } catch (error) {
          throw wrapError(error, "Failed to get taxonomy value");
        }
      }),
  }),
});

type TaxonomyRouter = typeof taxonomyRouter;
