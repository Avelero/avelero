/**
 * Validation schemas for showcase brand operations.
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
} from "../_shared/primitives.js";

/**
 * Empty payload for listing showcase brands.
 */
export const listShowcaseBrandsSchema = voidSchema;

/**
 * Payload for creating a showcase brand.
 */
export const createShowcaseBrandSchema = z.object({
  name: shortStringSchema,
  legal_name: shortStringSchema.optional(),
  email: emailSchema.optional(),
  phone: shortStringSchema.optional(),
  website: shortStringSchema.optional(),
  address_line_1: mediumStringSchema.optional(),
  address_line_2: mediumStringSchema.optional(),
  city: shortStringSchema.optional(),
  state: shortStringSchema.optional(),
  zip: shortStringSchema.optional(),
  country_code: countryCodeSchema.optional(),
});

/**
 * Payload for updating a showcase brand.
 */
export const updateShowcaseBrandSchema = updateWithNullable(
  createShowcaseBrandSchema,
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
 * Payload for deleting a showcase brand.
 */
export const deleteShowcaseBrandSchema = byIdSchema;
