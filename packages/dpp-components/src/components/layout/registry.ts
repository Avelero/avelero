/**
 * Fixed component registry — maps component IDs to their schemas and renderers.
 *
 * Used by the theme editor to discover editable fields for header, footer,
 * product image, and modals.
 */

import type { FixedComponentRegistryEntry } from "../../types/editor";
import { CERTIFICATION_MODAL_SCHEMA } from "../modals/certification/schema";
import { DESCRIPTION_MODAL_SCHEMA } from "../modals/description/schema";
import { IMPACT_MODAL_SCHEMA } from "../modals/impact/schema";
import { MANUFACTURER_MODAL_SCHEMA } from "../modals/manufacturer/schema";
import { OPERATOR_MODAL_SCHEMA } from "../modals/operator/schema";
import { Footer } from "./footer";
import { FOOTER_SCHEMA } from "./footer/schema";
import { Header } from "./header";
import { HEADER_SCHEMA } from "./header/schema";
import { ProductImage } from "./product-image";
import { PRODUCT_IMAGE_SCHEMA } from "./product-image/schema";

export const COMPONENT_REGISTRY: Record<string, FixedComponentRegistryEntry> = {
  header: {
    schema: HEADER_SCHEMA,
    component: Header as FixedComponentRegistryEntry["component"],
  },
  productImage: {
    schema: PRODUCT_IMAGE_SCHEMA,
    component: ProductImage as FixedComponentRegistryEntry["component"],
  },
  footer: {
    schema: FOOTER_SCHEMA,
    component: Footer as FixedComponentRegistryEntry["component"],
  },
};

/**
 * Per-modal-type schemas indexed by the section type that owns each modal.
 * Used by the theme editor to show per-modal editable building blocks.
 */
export const MODAL_SCHEMA_REGISTRY: Record<
  string,
  FixedComponentRegistryEntry
> = {
  impact: { schema: IMPACT_MODAL_SCHEMA, component: null },
  description: { schema: DESCRIPTION_MODAL_SCHEMA, component: null },
  details: { schema: MANUFACTURER_MODAL_SCHEMA, component: null },
  materials: { schema: CERTIFICATION_MODAL_SCHEMA, component: null },
  journey: { schema: OPERATOR_MODAL_SCHEMA, component: null },
};
