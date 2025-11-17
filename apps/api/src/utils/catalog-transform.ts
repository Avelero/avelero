/**
 * Transformation utilities for converting snake_case API schemas to camelCase database inputs.
 *
 * The API layer uses snake_case for consistency with REST conventions, while the database
 * layer uses camelCase for TypeScript conventions. This module bridges the gap.
 */

/**
 * Transforms season input from snake_case schema to camelCase DB format.
 */
export function transformSeasonInput<T extends Record<string, any>>(
  input: T,
): any {
  const result: any = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "start_date":
        // Convert YYYY-MM-DD string to Date object
        result.startDate = value ? new Date(value) : null;
        break;
      case "end_date":
        // Convert YYYY-MM-DD string to Date object
        result.endDate = value ? new Date(value) : null;
        break;
      default:
        result[key] = value;
    }
  }

  return result;
}

/**
 * Transforms size input from snake_case schema to camelCase DB format.
 */
export function transformSizeInput<T extends Record<string, any>>(
  input: T,
): any {
  const result: any = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "category_group":
        result.categoryGroup = value;
        break;
      case "category_id":
        result.categoryId = value;
        break;
      case "sort_index":
        result.sortIndex = value;
        break;
      default:
        result[key] = value;
    }
  }

  return result;
}

/**
 * Transforms material input from snake_case schema to camelCase DB format.
 */
export function transformMaterialInput<T extends Record<string, any>>(
  input: T,
): any {
  const result: any = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "certification_id":
        result.certificationId = value;
        break;
      case "country_of_origin":
        result.countryOfOrigin = value;
        break;
      default:
        result[key] = value;
    }
  }

  return result;
}

/**
 * Transforms certification input from snake_case schema to camelCase DB format.
 */
export function transformCertificationInput<T extends Record<string, any>>(
  input: T,
): any {
  const result: any = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "certification_code":
        result.certificationCode = value;
        break;
      case "institute_name":
        result.instituteName = value;
        break;
      case "institute_address":
        result.instituteAddress = value;
        break;
      case "institute_contact":
        result.instituteContact = value;
        break;
      case "issue_date":
        result.issueDate = value;
        break;
      case "expiry_date":
        result.expiryDate = value;
        break;
      case "file_asset_id":
        result.fileAssetId = value;
        break;
      case "external_url":
        result.externalUrl = value;
        break;
      default:
        result[key] = value;
    }
  }

  return result;
}

/**
 * Transforms facility input from snake_case schema to camelCase DB format.
 */
export function transformFacilityInput<T extends Record<string, any>>(
  input: T,
): any {
  const result: any = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "display_name":
        result.displayName = value;
        break;
      case "legal_name":
        result.legalName = value;
        break;
      case "country_code":
        result.countryCode = value;
        break;
      case "vat_number":
        result.vatNumber = value;
        break;
      default:
        result[key] = value;
    }
  }

  return result;
}

/**
 * Transforms showcase brand input from snake_case schema to camelCase DB format.
 */
export function transformShowcaseBrandInput<T extends Record<string, any>>(
  input: T,
): any {
  const result: any = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "legal_name":
        result.legalName = value;
        break;
      case "address_line_1":
        result.addressLine1 = value;
        break;
      case "address_line_2":
        result.addressLine2 = value;
        break;
      case "country_code":
        result.countryCode = value;
        break;
      default:
        result[key] = value;
    }
  }

  return result;
}