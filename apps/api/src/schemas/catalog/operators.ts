/**
 * Validation schemas for brand operator operations.
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
 * Empty payload for listing operators.
 */
export const listOperatorsSchema = voidSchema;

/**
 * Payload for creating an operator.
 */
export const createOperatorSchema = z.object({
  display_name: shortStringSchema,
  legal_name: shortStringSchema.optional(),
  email: shortStringSchema.optional(),
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
 * Payload for updating an operator.
 */
export const updateOperatorSchema = updateWithNullable(createOperatorSchema, [
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
]);

/**
 * Payload for deleting an operator.
 */
export const deleteOperatorSchema = byIdSchema;
