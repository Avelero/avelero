/**
 * Fixed component registry — maps component IDs to their schemas and renderers.
 *
 * Used by the theme editor to discover editable fields for header, footer,
 * product image, and modal.
 */

import type { FixedComponentRegistryEntry } from "../../types/editor";
import { MODAL_SCHEMA } from "../modal/schema";
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
  modal: {
    schema: MODAL_SCHEMA,
    component: null,
  },
  footer: {
    schema: FOOTER_SCHEMA,
    component: Footer as FixedComponentRegistryEntry["component"],
  },
};
