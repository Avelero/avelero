/**
 * Validation schemas for brand certification operations.
 */
import { z } from "zod";
import {
  byIdSchema,
  updateWithNullable,
  voidSchema,
} from "../_shared/patterns.js";
import {
  countryCodeSchema,
  datetimeSchema,
  emailSchema,
  mediumStringSchema,
  shortStringSchema,
  urlSchema,
} from "../_shared/primitives.js";

/**
 * Empty payload for listing certifications.
 */
export const listCertificationsSchema = voidSchema;

/**
 * Payload for creating a certification.
 */
export const createCertificationSchema = z.object({
  title: shortStringSchema,
  certification_code: shortStringSchema.optional(),
  institute_name: shortStringSchema.optional(),
  institute_email: emailSchema.optional(),
  institute_website: urlSchema.optional(),
  institute_address_line_1: mediumStringSchema.optional(),
  institute_address_line_2: mediumStringSchema.optional(),
  institute_city: shortStringSchema.optional(),
  institute_state: shortStringSchema.optional(),
  institute_zip: shortStringSchema.optional(),
  institute_country_code: countryCodeSchema.optional(),
  issue_date: datetimeSchema.optional(),
  expiry_date: datetimeSchema.optional(),
  certification_path: mediumStringSchema.optional(),
});

/**
 * Payload for updating a certification.
 */
export const updateCertificationSchema = updateWithNullable(
  createCertificationSchema,
  [
    "certification_code",
    "institute_name",
    "institute_email",
    "institute_website",
    "institute_address_line_1",
    "institute_address_line_2",
    "institute_city",
    "institute_state",
    "institute_zip",
    "institute_country_code",
    "issue_date",
    "expiry_date",
    "certification_path",
  ],
);

/**
 * Payload for deleting a certification.
 */
export const deleteCertificationSchema = byIdSchema;
