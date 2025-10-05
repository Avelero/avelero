import { z } from "zod";

// Colors
export const listColorsSchema = z.object({});
export const createColorSchema = z.object({ name: z.string().min(1) });
export const updateColorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});
export const deleteColorSchema = z.object({ id: z.string().uuid() });

// Sizes
export const listSizesSchema = z.object({
  category_id: z.string().uuid().optional(),
});
export const createSizeSchema = z.object({
  name: z.string().min(1),
  category_id: z.string().uuid().optional(),
  sort_index: z.number().int().optional(),
});
export const updateSizeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  category_id: z.string().uuid().optional(),
  sort_index: z.number().int().optional(),
});
export const deleteSizeSchema = z.object({ id: z.string().uuid() });

// Materials
export const listMaterialsSchema = z.object({});
export const createMaterialSchema = z.object({
  name: z.string().min(1),
  certification_id: z.string().uuid().optional(),
  recyclable: z.boolean().optional(),
  country_of_origin: z.string().optional(),
});
export const updateMaterialSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  certification_id: z.string().uuid().optional().nullable(),
  recyclable: z.boolean().optional().nullable(),
  country_of_origin: z.string().optional().nullable(),
});
export const deleteMaterialSchema = z.object({ id: z.string().uuid() });

// Certifications
export const listCertificationsSchema = z.object({});
export const createCertificationSchema = z.object({
  title: z.string().min(1),
  certification_code: z.string().optional(),
  institute_name: z.string().optional(),
  institute_address: z.string().optional(),
  institute_contact: z.string().optional(),
  issue_date: z.string().datetime().optional(),
  expiry_date: z.string().datetime().optional(),
  file_asset_id: z.string().uuid().optional(),
  external_url: z.string().url().optional(),
  notes: z.string().optional(),
});
export const updateCertificationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  certification_code: z.string().optional().nullable(),
  institute_name: z.string().optional().nullable(),
  institute_address: z.string().optional().nullable(),
  institute_contact: z.string().optional().nullable(),
  issue_date: z.string().datetime().optional().nullable(),
  expiry_date: z.string().datetime().optional().nullable(),
  file_asset_id: z.string().uuid().optional().nullable(),
  external_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export const deleteCertificationSchema = z.object({ id: z.string().uuid() });

// Eco-claims
export const listEcoClaimsSchema = z.object({});
export const createEcoClaimSchema = z.object({ claim: z.string().min(1) });
export const updateEcoClaimSchema = z.object({
  id: z.string().uuid(),
  claim: z.string().min(1).optional(),
});
export const deleteEcoClaimSchema = z.object({ id: z.string().uuid() });

// Facilities
export const listFacilitiesSchema = z.object({});
export const createFacilitySchema = z.object({
  display_name: z.string().min(1),
  legal_name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().optional(),
  contact: z.string().optional(),
  vat_number: z.string().optional(),
});
export const updateFacilitySchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1).optional(),
  legal_name: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  vat_number: z.string().optional().nullable(),
});
export const deleteFacilitySchema = z.object({ id: z.string().uuid() });

// Showcase brands
export const listShowcaseBrandsSchema = z.object({});
export const createShowcaseBrandSchema = z.object({
  name: z.string().min(1),
  legal_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country_code: z.string().optional(),
});
export const updateShowcaseBrandSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  legal_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  address_line_1: z.string().optional().nullable(),
  address_line_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
});
export const deleteShowcaseBrandSchema = z.object({ id: z.string().uuid() });
