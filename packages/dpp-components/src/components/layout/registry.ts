/**
 * Fixed component registry — maps component IDs to their schemas and renderers.
 *
 * Used by the theme editor to discover editable fields for header, footer,
 * product image, and modals.
 */

import type { FixedComponentRegistryEntry } from "../../types/editor";
import { SHARED_MODAL_SCHEMA } from "../modals/shared-schema";
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
 * Shared modal schema used by the theme editor.
 * The runtime still renders section-specific modal bodies, but they all
 * persist into this one shared modal style and content target.
 */
export const MODAL_SCHEMA_REGISTRY: Record<
  string,
  FixedComponentRegistryEntry
> = {
  modal: { schema: SHARED_MODAL_SCHEMA, component: null },
};
