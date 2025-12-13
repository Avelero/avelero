/**
 * Validation schemas for manufacturer operations.
 */
import { z } from "zod";
import {
  byIdSchema,
  updateWithNullable,
  voidSchema,
} from "../_shared/patterns.js";
import {
  countryCodeSchema,
  emailSchema,
  mediumStringSchema,
  shortStringSchema,
  urlSchema,
} from "../_shared/primitives.js";

/**
 * Empty payload for listing manufacturers.
 */
export const listManufacturersSchema = voidSchema;

/**
 * Payload for creating a manufacturer.
 */
export const createManufacturerSchema = z.object({
  name: shortStringSchema,
  legal_name: shortStringSchema.optional(),
  email: emailSchema.optional(),
  phone: shortStringSchema.optional(),
  website: urlSchema.optional(),
  address_line_1: mediumStringSchema.optional(),
  address_line_2: mediumStringSchema.optional(),
  city: shortStringSchema.optional(),
  state: shortStringSchema.optional(),
  zip: shortStringSchema.optional(),
  country_code: countryCodeSchema.optional(),
});

/**
 * Payload for updating a manufacturer.
 */
export const updateManufacturerSchema = updateWithNullable(
  createManufacturerSchema,
  [
    "legal_name",
    "email",
    "phone",
    "website",
    "address_line_1",
    "address_line_2",
    "city",
    "state",
    "zip",
    "country_code",
  ],
);

/**
 * Payload for deleting a manufacturer.
 */
export const deleteManufacturerSchema = byIdSchema;
