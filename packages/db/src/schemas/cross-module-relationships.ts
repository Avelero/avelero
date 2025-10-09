import { eq, and } from "drizzle-orm";
import {
  products,
  productVariants,
  passports,
  categories,
  brands,
  passportTemplates,
  modules,
  // Import other tables as needed
} from "../schema";
import {
  crossModuleRegistry,
  type CrossModuleRelationship,
} from "./cross-module-includes";

// ================================
// Cross-Module Relationship Definitions
// ================================

/**
 * Register all cross-module relationships
 * This defines how modules can include data from other modules
 */
export function initializeCrossModuleRelationships() {
  // =================
  // PASSPORT RELATIONSHIPS
  // =================

  // Passports -> Products
  crossModuleRegistry.register("passports", "product", {
    targetModule: "products",
    relationshipType: "many-to-one",
    sourceTable: passports,
    targetTable: products,
    joinCondition: (source, target) =>
      eq((source as any).productId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Passports -> Product Variants
  crossModuleRegistry.register("passports", "variant", {
    targetModule: "variants",
    relationshipType: "many-to-one",
    sourceTable: passports,
    targetTable: productVariants,
    joinCondition: (source, target) =>
      eq((source as any).variantId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Passports -> Passport Templates
  crossModuleRegistry.register("passports", "template", {
    targetModule: "passport_templates",
    relationshipType: "many-to-one",
    sourceTable: passports,
    targetTable: passportTemplates,
    joinCondition: (source, target) =>
      eq((source as any).templateId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Passports -> Brands (via brandId)
  crossModuleRegistry.register("passports", "brand", {
    targetModule: "brands",
    relationshipType: "many-to-one",
    sourceTable: passports,
    targetTable: brands,
    joinCondition: (source, target) =>
      eq((source as any).brandId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // =================
  // PRODUCT RELATIONSHIPS
  // =================

  // Products -> Variants
  crossModuleRegistry.register("products", "variants", {
    targetModule: "variants",
    relationshipType: "one-to-many",
    sourceTable: products,
    targetTable: productVariants,
    joinCondition: (source, target) =>
      eq((target as any).productId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "medium",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Products -> Categories
  crossModuleRegistry.register("products", "category", {
    targetModule: "categories",
    relationshipType: "many-to-one",
    sourceTable: products,
    targetTable: categories,
    joinCondition: (source, target) =>
      eq((source as any).categoryId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Products -> Passports
  crossModuleRegistry.register("products", "passports", {
    targetModule: "passports",
    relationshipType: "one-to-many",
    sourceTable: products,
    targetTable: passports,
    joinCondition: (source, target) =>
      eq((target as any).productId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "medium",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Products -> Brands
  crossModuleRegistry.register("products", "brand", {
    targetModule: "brands",
    relationshipType: "many-to-one",
    sourceTable: products,
    targetTable: brands,
    joinCondition: (source, target) =>
      eq((source as any).brandId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // =================
  // VARIANT RELATIONSHIPS
  // =================

  // Variants -> Products
  crossModuleRegistry.register("variants", "product", {
    targetModule: "products",
    relationshipType: "many-to-one",
    sourceTable: productVariants,
    targetTable: products,
    joinCondition: (source, target) =>
      eq((source as any).productId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Variants -> Passports
  crossModuleRegistry.register("variants", "passports", {
    targetModule: "passports",
    relationshipType: "one-to-many",
    sourceTable: productVariants,
    targetTable: passports,
    joinCondition: (source, target) =>
      eq((target as any).variantId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Variants -> Categories (via product)
  crossModuleRegistry.register("variants", "category", {
    targetModule: "categories",
    relationshipType: "many-to-one",
    sourceTable: productVariants,
    targetTable: categories,
    joinCondition: (source, target) => {
      // Join through products table
      const condition = and(
        eq((source as any).productId, (products as any).id),
        eq((products as any).categoryId, (target as any).id),
      );
      return condition!;
    },
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: true, // Prefer subquery due to intermediate join
      expensive: false,
    },
  });

  // =================
  // CATEGORY RELATIONSHIPS
  // =================

  // Categories -> Products
  crossModuleRegistry.register("categories", "products", {
    targetModule: "products",
    relationshipType: "one-to-many",
    sourceTable: categories,
    targetTable: products,
    joinCondition: (source, target) =>
      eq((target as any).categoryId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "high",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Categories -> Parent Category
  crossModuleRegistry.register("categories", "parent", {
    targetModule: "categories",
    relationshipType: "many-to-one",
    sourceTable: categories,
    targetTable: categories,
    joinCondition: (source, target) =>
      eq((source as any).parentId, (target as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "low",
      preferSubquery: false,
      expensive: false,
    },
  });

  // Categories -> Child Categories
  crossModuleRegistry.register("categories", "children", {
    targetModule: "categories",
    relationshipType: "one-to-many",
    sourceTable: categories,
    targetTable: categories,
    joinCondition: (source, target) =>
      eq((target as any).parentId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "medium",
      preferSubquery: false,
      expensive: false,
    },
  });

  // =================
  // PASSPORT TEMPLATE RELATIONSHIPS
  // =================

  // Passport Templates -> Passports
  crossModuleRegistry.register("passport_templates", "passports", {
    targetModule: "passports",
    relationshipType: "one-to-many",
    sourceTable: passportTemplates,
    targetTable: passports,
    joinCondition: (source, target) =>
      eq((target as any).templateId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "medium",
      preferSubquery: false,
      expensive: false,
    },
  });

  // =================
  // MODULE RELATIONSHIPS (temporarily disabled)
  // =================

  // Note: Generic templates relationship disabled until templates table is defined
  // crossModuleRegistry.register("modules", "template", { ... });

  // =================
  // BRAND RELATIONSHIPS
  // =================

  // Brands -> Products
  crossModuleRegistry.register("brands", "products", {
    targetModule: "products",
    relationshipType: "one-to-many",
    sourceTable: brands,
    targetTable: products,
    joinCondition: (source, target) =>
      eq((target as any).brandId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "high",
      preferSubquery: false,
      expensive: true, // Could be expensive for large brands
    },
  });

  // Brands -> Passports
  crossModuleRegistry.register("brands", "passports", {
    targetModule: "passports",
    relationshipType: "one-to-many",
    sourceTable: brands,
    targetTable: passports,
    joinCondition: (source, target) =>
      eq((target as any).brandId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "high",
      preferSubquery: false,
      expensive: true, // Could be expensive for large brands
    },
  });

  // Brands -> Passport Templates
  crossModuleRegistry.register("brands", "passport_templates", {
    targetModule: "passport_templates",
    relationshipType: "one-to-many",
    sourceTable: brands,
    targetTable: passportTemplates,
    joinCondition: (source, target) =>
      eq((target as any).brandId, (source as any).id),
    includeSupported: true,
    performance: {
      expectedCardinality: "medium",
      preferSubquery: false,
      expensive: false,
    },
  });
}

/**
 * Get all available cross-module includes for a specific module
 */
export function getAvailableCrossModuleIncludes(moduleId: string): string[] {
  return crossModuleRegistry.getAvailableIncludes(moduleId);
}

/**
 * Get relationship information for debugging/documentation
 */
export function getCrossModuleRelationshipInfo(moduleId: string) {
  const relationships = crossModuleRegistry.getRelationships(moduleId);

  return Array.from(relationships.entries()).map(([key, relationship]) => ({
    key,
    targetModule: relationship.targetModule,
    relationshipType: relationship.relationshipType,
    includeSupported: relationship.includeSupported,
    performance: relationship.performance,
  }));
}

/**
 * Initialize all relationships when the module is imported
 */
initializeCrossModuleRelationships();
