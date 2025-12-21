/**
 * Value Extraction Logic
 *
 * Extracts and transforms values from external data using field mappings.
 */

import { createHash } from "node:crypto";
import type { ConnectorFieldDefinition, ConnectorSchema } from "../connectors/types";
import type { ExtractedValues, FieldConfig } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface EffectiveFieldMapping {
  fieldKey: string;
  definition: ConnectorFieldDefinition;
  sourceKey: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a value from a nested object using dot notation path.
 * Use "." as path to return the root object.
 */
export function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  // Special case: "." returns the root object
  if (path === ".") return obj;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Build effective field mappings from schema and configs.
 * Only includes fields that are enabled for this integration.
 */
export function buildEffectiveFieldMappings(
  schema: ConnectorSchema,
  fieldConfigs: FieldConfig[]
): EffectiveFieldMapping[] {
  const mappings: EffectiveFieldMapping[] = [];
  const configMap = new Map(
    fieldConfigs
      .filter((c) => c.isEnabled)
      .map((c) => [c.fieldKey, c.selectedSource])
  );

  for (const [fieldKey, definition] of Object.entries(schema.fields)) {
    // If there's a config, use it; otherwise use default
    const isEnabled = configMap.has(fieldKey) || !fieldConfigs.length;
    if (!isEnabled) continue;

    const sourceKey = configMap.get(fieldKey) ?? definition.defaultSource;

    mappings.push({
      fieldKey,
      definition,
      sourceKey,
    });
  }

  return mappings;
}

/**
 * Extract values from external data using field mappings.
 */
export function extractValues(
  externalData: Record<string, unknown>,
  mappings: EffectiveFieldMapping[]
): ExtractedValues {
  const result: ExtractedValues = {
    product: {},
    variant: {},
    referenceEntities: {},
    relations: {},
  };

  for (const mapping of mappings) {
    const { fieldKey, definition, sourceKey } = mapping;

    // Find the source option
    const sourceOption = definition.sourceOptions.find(
      (opt) => opt.key === sourceKey
    );
    if (!sourceOption) continue;

    // Get raw value
    let value = getValueByPath(externalData, sourceOption.path);

    // Apply source-specific transform
    if (sourceOption.transform && value !== undefined) {
      value = sourceOption.transform(value);
    }

    // Apply global transform
    if (definition.transform && value !== undefined) {
      value = definition.transform(value);
    }

    // Skip null/undefined values
    if (value === null || value === undefined) continue;

    // Parse field key safely
    const dotIndex = fieldKey.indexOf(".");
    if (dotIndex === -1) continue;

    const entityType = fieldKey.slice(0, dotIndex);
    const fieldName = fieldKey.slice(dotIndex + 1);

    // Handle reference entities (can be on product or variant level)
    if (definition.referenceEntity) {
      if (definition.referenceEntity === "category") {
        // Store category UUID directly (resolved from Shopify taxonomy mapping)
        // Categories are system-level and the UUID is resolved in the schema transform
        result.referenceEntities.categoryId = String(value);
      }
      // Don't put reference entity values directly in product/variant objects
      continue;
    }

    if (entityType === "product") {
      result.product[fieldName] = value;
    } else if (entityType === "variant") {
      result.variant[fieldName] = value;
    }

    // Handle relations (tags)
    if (definition.isRelation && definition.relationType === "tags") {
      result.relations.tags = value as string[];
    }
  }

  return result;
}

/**
 * Compute a hash of extracted values for change detection.
 */
export function computeHash(values: ExtractedValues): string {
  const str = JSON.stringify(values);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

