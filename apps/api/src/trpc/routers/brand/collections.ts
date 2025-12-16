/**
 * Brand collections router.
 *
 * Manages saved product filter presets (collections) that users can create
 * to quickly access commonly used filter configurations.
 *
 * Targets:
 * - brand.collections.list
 * - brand.collections.create
 * - brand.collections.update
 * - brand.collections.delete
 */
import {
  createCollection,
  deleteCollection,
  listCollections,
  updateCollection,
} from "@v1/db/queries/brand";
import {
  collectionCreateSchema,
  collectionDeleteSchema,
  collectionUpdateSchema,
} from "../../../schemas/brand-collections.js";
import { notFound, wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

export const brandCollectionsRouter = createTRPCRouter({
  /**
   * Lists all collections for the active brand.
   */
  list: brandRequiredProcedure.query(async ({ ctx }) => {
    const { db, brandId } = ctx;
    try {
      const collections = await listCollections(db, brandId);
      return { data: collections };
    } catch (error) {
      throw wrapError(error, "Failed to list collections");
    }
  }),

  /**
   * Creates a new collection for the active brand.
   */
  create: brandRequiredProcedure
    .input(collectionCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        const collection = await createCollection(db, brandId, input);
        return { data: collection };
      } catch (error) {
        throw wrapError(error, "Failed to create collection");
      }
    }),

  /**
   * Updates an existing collection.
   */
  update: brandRequiredProcedure
    .input(collectionUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        const { id, ...updateData } = input;
        const collection = await updateCollection(db, brandId, id, updateData);
        if (!collection) {
          throw notFound("collection", id);
        }
        return { data: collection };
      } catch (error) {
        throw wrapError(error, "Failed to update collection");
      }
    }),

  /**
   * Deletes a collection.
   */
  delete: brandRequiredProcedure
    .input(collectionDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        const collection = await deleteCollection(db, brandId, input.id);
        if (!collection) {
          throw notFound("collection", input.id);
        }
        return { data: collection };
      } catch (error) {
        throw wrapError(error, "Failed to delete collection");
      }
    }),
});

export type BrandCollectionsRouter = typeof brandCollectionsRouter;

