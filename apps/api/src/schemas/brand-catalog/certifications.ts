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
  datetimeSchema,
  longStringSchema,
  mediumStringSchema,
  shortStringSchema,
  urlSchema,
  uuidSchema,
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
  institute_address: mediumStringSchema.optional(),
  institute_contact: shortStringSchema.optional(),
  issue_date: datetimeSchema.optional(),
  expiry_date: datetimeSchema.optional(),
  file_asset_id: uuidSchema.optional(),
  external_url: urlSchema.optional(),
  notes: longStringSchema.optional(),
});

/**
 * Payload for updating a certification.
 */
export const updateCertificationSchema = updateWithNullable(
  createCertificationSchema,
  [
    "certification_code",
    "institute_name",
    "institute_address",
    "institute_contact",
    "issue_date",
    "expiry_date",
    "file_asset_id",
    "external_url",
    "notes",
  ],
);

/**
 * Payload for deleting a certification.
 */
export const deleteCertificationSchema = byIdSchema;
