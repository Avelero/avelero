/**
 * Catalog entity validation and duplicate checking.
 *
 * Consolidates validation logic and duplicate detection for all catalog entity types.
 */

import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandCertifications,
  brandManufacturers,
  brandMaterials,
  brandOperators,
  brandSeasons,
  brandTags,
} from "../../schema";
import { createCertification } from "./certifications";
import { createBrandManufacturer } from "./manufacturers";
import { createMaterial } from "./materials";
import { createOperator } from "./operators";
import { createSeason } from "./seasons";
import { createBrandTag } from "./tags";
import type {
  CatalogEntityType,
  ValidationError,
  ValidationResult,
} from "./types";

/**
 * Configuration map for duplicate checking by entity type.
 */
const DUPLICATE_CHECK_CONFIG = {
  MATERIAL: {
    table: brandMaterials,
    nameColumn: brandMaterials.name,
  },
  OPERATOR: {
    table: brandOperators,
    nameColumn: brandOperators.displayName,
  },
  MANUFACTURER: {
    table: brandManufacturers,
    nameColumn: brandManufacturers.name,
  },
  CERTIFICATION: {
    table: brandCertifications,
    nameColumn: brandCertifications.title,
  },
  SEASON: {
    table: brandSeasons,
    nameColumn: brandSeasons.name,
  },
  TAG: {
    table: brandTags,
    nameColumn: brandTags.name,
  },
} as const;

/**
 * Checks if a name already exists for a given entity type (case-insensitive).
 *
 * @param db - Database instance
 * @param brandId - Brand ID
 * @param entityType - Entity type to check
 * @param name - Name to check
 * @returns True if duplicate exists
 */
export async function checkDuplicateName(
  db: Database,
  brandId: string,
  entityType: CatalogEntityType,
  name: string,
): Promise<boolean> {
  const config = DUPLICATE_CHECK_CONFIG[entityType];
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(config.table)
    .where(
      and(
        eq(config.table.brandId, brandId),
        sql`LOWER(${config.nameColumn}) = LOWER(${name})`,
      ),
    );
  return (result?.count ?? 0) > 0;
}

/**
 * Validates material input.
 */
export function validateMaterialInput(input: {
  name: string;
  certificationId?: string | null;
  recyclable?: boolean | null;
  countryOfOrigin?: string | null;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Material name is required",
      code: "REQUIRED",
    });
  } else if (input.name.length > 100) {
    errors.push({
      field: "name",
      message: "Material name too long",
      code: "TOO_LONG",
    });
  }
  if (
    input.countryOfOrigin &&
    !/^[A-Z]{2}$/.test(input.countryOfOrigin.toUpperCase())
  ) {
    errors.push({
      field: "countryOfOrigin",
      message: "Country of origin must be a 2-letter ISO code",
      code: "INVALID_FORMAT",
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates operator input.
 */
export function validateOperatorInput(input: {
  displayName: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  countryCode?: string | null;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.displayName || input.displayName.trim().length === 0) {
    errors.push({
      field: "displayName",
      message: "Display name is required",
      code: "REQUIRED",
    });
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({
      field: "email",
      message: "Invalid email format",
      code: "INVALID_FORMAT",
    });
  }
  if (input.website) {
    try {
      new URL(input.website);
    } catch {
      errors.push({
        field: "website",
        message: "Invalid website URL",
        code: "INVALID_FORMAT",
      });
    }
  }
  if (
    input.countryCode &&
    !/^[A-Z]{2}$/.test(input.countryCode.toUpperCase())
  ) {
    errors.push({
      field: "countryCode",
      message: "Country code must be 2 letters",
      code: "INVALID_FORMAT",
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates manufacturer input.
 */
export function validateBrandManufacturerInput(input: {
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  countryCode?: string | null;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Brand manufacturer name is required",
      code: "REQUIRED",
    });
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({
      field: "email",
      message: "Invalid email format",
      code: "INVALID_FORMAT",
    });
  }
  if (input.website) {
    try {
      new URL(input.website);
    } catch {
      errors.push({
        field: "website",
        message: "Invalid website URL",
        code: "INVALID_FORMAT",
      });
    }
  }
  if (
    input.countryCode &&
    !/^[A-Z]{2}$/.test(input.countryCode.toUpperCase())
  ) {
    errors.push({
      field: "countryCode",
      message: "Country code must be 2 letters",
      code: "INVALID_FORMAT",
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates certification input.
 */
export function validateCertificationInput(input: {
  title: string;
  certificationCode?: string;
  instituteName?: string;
  instituteEmail?: string;
  instituteWebsite?: string;
  instituteAddressLine1?: string;
  instituteAddressLine2?: string;
  instituteCity?: string;
  instituteState?: string;
  instituteZip?: string;
  instituteCountryCode?: string;
  issueDate?: string;
  expiryDate?: string;
  certificationPath?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.title || input.title.trim().length === 0) {
    errors.push({
      field: "title",
      message: "Certification title is required",
      code: "REQUIRED",
    });
  }

  if (
    input.instituteEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.instituteEmail)
  ) {
    errors.push({
      field: "instituteEmail",
      message: "Invalid email format",
      code: "INVALID_FORMAT",
    });
  }

  if (input.instituteWebsite) {
    try {
      new URL(input.instituteWebsite);
    } catch {
      errors.push({
        field: "instituteWebsite",
        message: "Invalid website URL",
        code: "INVALID_FORMAT",
      });
    }
  }

  if (
    input.instituteCountryCode &&
    !/^[A-Z]{2}$/.test(input.instituteCountryCode.toUpperCase())
  ) {
    errors.push({
      field: "instituteCountryCode",
      message: "Country code must be 2 letters",
      code: "INVALID_FORMAT",
    });
  }

  if (input.issueDate) {
    const issueDate = new Date(input.issueDate);
    if (Number.isNaN(issueDate.getTime())) {
      errors.push({
        field: "issueDate",
        message: "Invalid issue date",
        code: "INVALID_FORMAT",
      });
    }
  }
  if (input.expiryDate) {
    const expiryDate = new Date(input.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) {
      errors.push({
        field: "expiryDate",
        message: "Invalid expiry date",
        code: "INVALID_FORMAT",
      });
    } else if (input.issueDate) {
      const issueDate = new Date(input.issueDate);
      if (!Number.isNaN(issueDate.getTime()) && expiryDate <= issueDate) {
        errors.push({
          field: "expiryDate",
          message: "Expiry date must be after issue date",
          code: "INVALID_VALUE",
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates and creates a catalog entity.
 *
 * This is a unified entry point for creating entities with validation
 * and duplicate checking. Used primarily by bulk import workflows.
 */
export async function validateAndCreateEntity(
  db: Database,
  brandId: string,
  entityType: CatalogEntityType,
  input: unknown,
): Promise<{ id: string }> {
  let validation: ValidationResult;
  let name: string;

  switch (entityType) {
    case "MATERIAL":
      validation = validateMaterialInput(
        input as {
          name: string;
          certificationId?: string | null;
          recyclable?: boolean | null;
          countryOfOrigin?: string | null;
        },
      );
      name = (input as { name: string }).name;
      break;
    case "OPERATOR":
      validation = validateOperatorInput(
        input as {
          displayName: string;
          legalName?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          addressLine1?: string | null;
          addressLine2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          countryCode?: string | null;
        },
      );
      name = (input as { displayName: string }).displayName;
      break;
    case "MANUFACTURER":
      validation = validateBrandManufacturerInput(
        input as {
          name: string;
          legalName?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          addressLine1?: string | null;
          addressLine2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          countryCode?: string | null;
        },
      );
      name = (input as { name: string }).name;
      break;
    case "CERTIFICATION":
      validation = validateCertificationInput(
        input as {
          title: string;
          certificationCode?: string;
          instituteName?: string;
          instituteEmail?: string;
          instituteWebsite?: string;
          instituteAddressLine1?: string;
          instituteAddressLine2?: string;
          instituteCity?: string;
          instituteState?: string;
          instituteZip?: string;
          instituteCountryCode?: string;
          issueDate?: string;
          expiryDate?: string;
          certificationPath?: string;
        },
      );
      name = (input as { title: string }).title;
      break;
    case "SEASON":
      // Seasons have their own validation in the create function
      name = (input as { name: string }).name;
      validation = { valid: true, errors: [] };
      break;
    case "TAG":
      // Tags have their own validation in the create function
      name = (input as { name: string }).name;
      validation = { valid: true, errors: [] };
      break;
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }

  if (!validation.valid) {
    const errorMsg = validation.errors
      .map((e) => `${e.field}: ${e.message}`)
      .join("; ");
    throw new Error(`Validation failed: ${errorMsg}`);
  }

  const duplicate = await checkDuplicateName(db, brandId, entityType, name);
  if (duplicate) {
    throw new Error(
      `${entityType} with name "${name}" already exists for this brand`,
    );
  }

  switch (entityType) {
    case "MATERIAL":
      return (
        (await createMaterial(
          db,
          brandId,
          input as {
            name: string;
            certificationId?: string;
            recyclable?: boolean;
            countryOfOrigin?: string;
          },
        )) ?? { id: "" }
      );
    case "OPERATOR":
      return (
        (await createOperator(
          db,
          brandId,
          input as {
            displayName: string;
            legalName?: string;
            email?: string;
            phone?: string;
            website?: string;
            addressLine1?: string;
            addressLine2?: string;
            city?: string;
            state?: string;
            zip?: string;
            countryCode?: string;
          },
        )) ?? { id: "" }
      );
    case "MANUFACTURER":
      return (
        (await createBrandManufacturer(
          db,
          brandId,
          input as { name: string },
        )) ?? {
          id: "",
        }
      );
    case "CERTIFICATION":
      return (
        (await createCertification(
          db,
          brandId,
          input as { title: string },
        )) ?? { id: "" }
      );
    case "SEASON":
      return (
        (await createSeason(
          db,
          brandId,
          input as {
            name: string;
            startDate?: Date | null;
            endDate?: Date | null;
            ongoing?: boolean;
          },
        )) ?? { id: "" }
      );
    case "TAG":
      return (
        (await createBrandTag(
          db,
          brandId,
          input as { name: string; hex?: string | null },
        )) ?? { id: "" }
      );
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }
}
