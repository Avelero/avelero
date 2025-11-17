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
  address_line_1: mediumStringSchema.optional(),
  address_line_2: mediumStringSchema.optional(),
  city: shortStringSchema.optional(),
  state: shortStringSchema.optional(),
  zip: shortStringSchema.optional(),
  country_code: countryCodeSchema.optional(),
  phone: shortStringSchema.optional(),
  email: shortStringSchema.optional(),
});

/**
 * Payload for updating a facility.
 */
export const updateFacilitySchema = updateWithNullable(createFacilitySchema, [
  "legal_name",
  "address_line_1",
  "address_line_2",
  "city",
  "state",
  "zip",
  "country_code",
  "phone",
  "email",
]);

/**
 * Payload for deleting a facility.
 */
export const deleteFacilitySchema = byIdSchema;
