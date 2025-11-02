/**
 * Validation schemas for brand facility operations.
 */
import { z } from "zod";
import {
  byIdSchema,
  updateWithNullable,
  voidSchema,
} from "../_shared/patterns.js";
import {
  countryCodeSchema,
  mediumStringSchema,
  shortStringSchema,
} from "../_shared/primitives.js";

/**
 * Empty payload for listing facilities.
 */
export const listFacilitiesSchema = voidSchema;

/**
 * Payload for creating a facility.
 */
export const createFacilitySchema = z.object({
  display_name: shortStringSchema,
  legal_name: shortStringSchema.optional(),
  address: mediumStringSchema.optional(),
  city: shortStringSchema.optional(),
  country_code: countryCodeSchema.optional(),
  contact: shortStringSchema.optional(),
  vat_number: shortStringSchema.optional(),
});

/**
 * Payload for updating a facility.
 */
export const updateFacilitySchema = updateWithNullable(createFacilitySchema, [
  "legal_name",
  "address",
  "city",
  "country_code",
  "contact",
  "vat_number",
]);

/**
 * Payload for deleting a facility.
 */
export const deleteFacilitySchema = byIdSchema;
