import { relations } from "drizzle-orm/relations";
import { brands, usersOnBrand, users, brandInvites, usersInAuth, passports, products, passportTemplates, productVariants, categories, brandCertifications, fileAssets, brandCollections, passportTemplateModules, passportModuleCompletion, brandColors, brandEcoClaims, brandFacilities, brandMaterials, brandServices, brandSizes, showcaseBrands, productMaterials, productJourneySteps, productEnvironment, productIdentifiers, productVariantIdentifiers, productEcoClaims, careCodes, productCareCodes, importJobs, importRows, valueMappings } from "./schema";

export const usersOnBrandRelations = relations(usersOnBrand, ({one}) => ({
	brand: one(brands, {
		fields: [usersOnBrand.brandId],
		references: [brands.id]
	}),
	user: one(users, {
		fields: [usersOnBrand.userId],
		references: [users.id]
	}),
}));

export const brandsRelations = relations(brands, ({many}) => ({
	usersOnBrands: many(usersOnBrand),
	brandInvites: many(brandInvites),
	passports: many(passports),
	brandCertifications: many(brandCertifications),
	brandCollections: many(brandCollections),
	passportTemplates: many(passportTemplates),
	brandColors: many(brandColors),
	brandEcoClaims: many(brandEcoClaims),
	brandFacilities: many(brandFacilities),
	brandMaterials: many(brandMaterials),
	brandServices: many(brandServices),
	brandSizes: many(brandSizes),
	showcaseBrands: many(showcaseBrands),
	products: many(products),
	fileAssets: many(fileAssets),
	importJobs: many(importJobs),
	valueMappings: many(valueMappings),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	usersOnBrands: many(usersOnBrand),
	usersInAuth: one(usersInAuth, {
		fields: [users.id],
		references: [usersInAuth.id]
	}),
}));

export const brandInvitesRelations = relations(brandInvites, ({one}) => ({
	brand: one(brands, {
		fields: [brandInvites.brandId],
		references: [brands.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	users: many(users),
}));

export const passportsRelations = relations(passports, ({one, many}) => ({
	brand: one(brands, {
		fields: [passports.brandId],
		references: [brands.id]
	}),
	product: one(products, {
		fields: [passports.productId],
		references: [products.id]
	}),
	passportTemplate: one(passportTemplates, {
		fields: [passports.templateId],
		references: [passportTemplates.id]
	}),
	productVariant: one(productVariants, {
		fields: [passports.variantId],
		references: [productVariants.id]
	}),
	passportModuleCompletions: many(passportModuleCompletion),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	passports: many(passports),
	brandCertification: one(brandCertifications, {
		fields: [products.brandCertificationId],
		references: [brandCertifications.id]
	}),
	brand: one(brands, {
		fields: [products.brandId],
		references: [brands.id]
	}),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id]
	}),
	showcaseBrand: one(showcaseBrands, {
		fields: [products.showcaseBrandId],
		references: [showcaseBrands.id]
	}),
	productVariants: many(productVariants),
	productMaterials: many(productMaterials),
	productJourneySteps: many(productJourneySteps),
	productEnvironments: many(productEnvironment),
	productIdentifiers: many(productIdentifiers),
	productEcoClaims: many(productEcoClaims),
	productCareCodes: many(productCareCodes),
}));

export const passportTemplatesRelations = relations(passportTemplates, ({one, many}) => ({
	passports: many(passports),
	brand: one(brands, {
		fields: [passportTemplates.brandId],
		references: [brands.id]
	}),
	passportTemplateModules: many(passportTemplateModules),
}));

export const productVariantsRelations = relations(productVariants, ({one, many}) => ({
	passports: many(passports),
	brandColor: one(brandColors, {
		fields: [productVariants.colorId],
		references: [brandColors.id]
	}),
	product: one(products, {
		fields: [productVariants.productId],
		references: [products.id]
	}),
	brandSize: one(brandSizes, {
		fields: [productVariants.sizeId],
		references: [brandSizes.id]
	}),
	productVariantIdentifiers: many(productVariantIdentifiers),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	category: one(categories, {
		fields: [categories.parentId],
		references: [categories.id],
		relationName: "categories_parentId_categories_id"
	}),
	categories: many(categories, {
		relationName: "categories_parentId_categories_id"
	}),
	brandSizes: many(brandSizes),
	products: many(products),
}));

export const brandCertificationsRelations = relations(brandCertifications, ({one, many}) => ({
	brand: one(brands, {
		fields: [brandCertifications.brandId],
		references: [brands.id]
	}),
	fileAsset: one(fileAssets, {
		fields: [brandCertifications.fileAssetId],
		references: [fileAssets.id]
	}),
	brandMaterials: many(brandMaterials),
	products: many(products),
}));

export const fileAssetsRelations = relations(fileAssets, ({one, many}) => ({
	brandCertifications: many(brandCertifications),
	brand: one(brands, {
		fields: [fileAssets.brandId],
		references: [brands.id]
	}),
}));

export const brandCollectionsRelations = relations(brandCollections, ({one}) => ({
	brand: one(brands, {
		fields: [brandCollections.brandId],
		references: [brands.id]
	}),
}));

export const passportTemplateModulesRelations = relations(passportTemplateModules, ({one}) => ({
	passportTemplate: one(passportTemplates, {
		fields: [passportTemplateModules.templateId],
		references: [passportTemplates.id]
	}),
}));

export const passportModuleCompletionRelations = relations(passportModuleCompletion, ({one}) => ({
	passport: one(passports, {
		fields: [passportModuleCompletion.passportId],
		references: [passports.id]
	}),
}));

export const brandColorsRelations = relations(brandColors, ({one, many}) => ({
	brand: one(brands, {
		fields: [brandColors.brandId],
		references: [brands.id]
	}),
	productVariants: many(productVariants),
}));

export const brandEcoClaimsRelations = relations(brandEcoClaims, ({one, many}) => ({
	brand: one(brands, {
		fields: [brandEcoClaims.brandId],
		references: [brands.id]
	}),
	productEcoClaims: many(productEcoClaims),
}));

export const brandFacilitiesRelations = relations(brandFacilities, ({one, many}) => ({
	brand: one(brands, {
		fields: [brandFacilities.brandId],
		references: [brands.id]
	}),
	productJourneySteps: many(productJourneySteps),
}));

export const brandMaterialsRelations = relations(brandMaterials, ({one, many}) => ({
	brand: one(brands, {
		fields: [brandMaterials.brandId],
		references: [brands.id]
	}),
	brandCertification: one(brandCertifications, {
		fields: [brandMaterials.certificationId],
		references: [brandCertifications.id]
	}),
	productMaterials: many(productMaterials),
}));

export const brandServicesRelations = relations(brandServices, ({one}) => ({
	brand: one(brands, {
		fields: [brandServices.brandId],
		references: [brands.id]
	}),
}));

export const brandSizesRelations = relations(brandSizes, ({one, many}) => ({
	brand: one(brands, {
		fields: [brandSizes.brandId],
		references: [brands.id]
	}),
	category: one(categories, {
		fields: [brandSizes.categoryId],
		references: [categories.id]
	}),
	productVariants: many(productVariants),
}));

export const showcaseBrandsRelations = relations(showcaseBrands, ({one, many}) => ({
	brand: one(brands, {
		fields: [showcaseBrands.brandId],
		references: [brands.id]
	}),
	products: many(products),
}));

export const productMaterialsRelations = relations(productMaterials, ({one}) => ({
	brandMaterial: one(brandMaterials, {
		fields: [productMaterials.brandMaterialId],
		references: [brandMaterials.id]
	}),
	product: one(products, {
		fields: [productMaterials.productId],
		references: [products.id]
	}),
}));

export const productJourneyStepsRelations = relations(productJourneySteps, ({one}) => ({
	brandFacility: one(brandFacilities, {
		fields: [productJourneySteps.facilityId],
		references: [brandFacilities.id]
	}),
	product: one(products, {
		fields: [productJourneySteps.productId],
		references: [products.id]
	}),
}));

export const productEnvironmentRelations = relations(productEnvironment, ({one}) => ({
	product: one(products, {
		fields: [productEnvironment.productId],
		references: [products.id]
	}),
}));

export const productIdentifiersRelations = relations(productIdentifiers, ({one}) => ({
	product: one(products, {
		fields: [productIdentifiers.productId],
		references: [products.id]
	}),
}));

export const productVariantIdentifiersRelations = relations(productVariantIdentifiers, ({one}) => ({
	productVariant: one(productVariants, {
		fields: [productVariantIdentifiers.variantId],
		references: [productVariants.id]
	}),
}));

export const productEcoClaimsRelations = relations(productEcoClaims, ({one}) => ({
	brandEcoClaim: one(brandEcoClaims, {
		fields: [productEcoClaims.ecoClaimId],
		references: [brandEcoClaims.id]
	}),
	product: one(products, {
		fields: [productEcoClaims.productId],
		references: [products.id]
	}),
}));

export const productCareCodesRelations = relations(productCareCodes, ({one}) => ({
	careCode: one(careCodes, {
		fields: [productCareCodes.careCodeId],
		references: [careCodes.id]
	}),
	product: one(products, {
		fields: [productCareCodes.productId],
		references: [products.id]
	}),
}));

export const careCodesRelations = relations(careCodes, ({many}) => ({
	productCareCodes: many(productCareCodes),
}));

export const importJobsRelations = relations(importJobs, ({one, many}) => ({
	brand: one(brands, {
		fields: [importJobs.brandId],
		references: [brands.id]
	}),
	importRows: many(importRows),
}));

export const importRowsRelations = relations(importRows, ({one}) => ({
	importJob: one(importJobs, {
		fields: [importRows.jobId],
		references: [importJobs.id]
	}),
}));

export const valueMappingsRelations = relations(valueMappings, ({one}) => ({
	brand: one(brands, {
		fields: [valueMappings.brandId],
		references: [brands.id]
	}),
}));