/**
 * Validation schemas for brand eco claim operations.
 */
import { z } from "zod";
import { byIdSchema, updateFrom, voidSchema } from "../_shared/patterns.js";
import { mediumStringSchema, uuidSchema } from "../_shared/primitives.js";

/**
 * Empty payload for listing eco claims.
 */
export const listEcoClaimsSchema = voidSchema;

/**
 * Payload for creating an eco claim.
 */
export const createEcoClaimSchema = z.object({ claim: mediumStringSchema });

/**
 * Payload for updating an eco claim.
 */
export const updateEcoClaimSchema = updateFrom(createEcoClaimSchema);

/**
 * Payload for deleting an eco claim.
 */
export const deleteEcoClaimSchema = byIdSchema;
