/**
 * Carousel section schema.
 *
 * Defines the editor controls for the similar products carousel.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const CAROUSEL_SCHEMA: SectionSchema = {
  type: "carousel",
  displayName: "Similar Products",
  allowedZones: ["canvas"],
  hidden: true,
  editorTree: {
    id: "carousel",
    displayName: "Similar Products",
    styleFields: [
      { type: "color", path: "title.color", label: "Color", section: "Title" },
      {
        type: "typescale",
        path: "title.typescale",
        label: "Typography",
        section: "Title",
      },
      {
        type: "select",
        path: "title.textTransform",
        label: "Capitalization",
        section: "Title",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "navButton.color",
        label: "Icon Color",
        section: "Nav Button",
      },
      {
        type: "color",
        path: "navButton.backgroundColor",
        label: "Background",
        section: "Nav Button",
      },
      {
        type: "color",
        path: "navButton.borderColor",
        label: "Border Color",
        section: "Nav Button",
      },
      {
        type: "color",
        path: "productImage.borderColor",
        label: "Border Color",
        section: "Product Image",
      },
      {
        type: "radius",
        path: "productImage.borderRadius",
        label: "Border Radius",
        section: "Product Image",
      },
      {
        type: "color",
        path: "productName.color",
        label: "Color",
        section: "Product Name",
      },
      {
        type: "typescale",
        path: "productName.typescale",
        label: "Typography",
        section: "Product Name",
      },
      {
        type: "select",
        path: "productName.textTransform",
        label: "Capitalization",
        section: "Product Name",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "productPrice.color",
        label: "Color",
        section: "Product Price",
      },
      {
        type: "typescale",
        path: "productPrice.typescale",
        label: "Typography",
        section: "Product Price",
      },
      {
        type: "select",
        path: "productPrice.textTransform",
        label: "Capitalization",
        section: "Product Price",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
    ],
    configFields: [
      { type: "toggle", path: "showTitle", label: "Show Title" },
      { type: "toggle", path: "showPrice", label: "Show Price" },
      { type: "toggle", path: "roundPrice", label: "Round Price" },
      {
        type: "number",
        path: "productCount",
        label: "Product Count",
        min: 1,
        max: 12,
      },
    ],
  },
  defaults: {
    styles: {
      title: { typescale: "h6", color: "$foreground", textTransform: "none" },
      navButton: {
        color: "$foreground",
        backgroundColor: "$background",
        borderColor: "$border",
      },
      productImage: { borderColor: "$border", borderRadius: 0 },
      productDetails: {},
      productName: {
        typescale: "body-sm",
        color: "$foreground",
        textTransform: "none",
      },
      productPrice: {
        typescale: "body-sm",
        color: "$foreground",
        textTransform: "none",
      },
    },
    content: {
      showTitle: true,
      showPrice: true,
      roundPrice: true,
      productCount: 6,
    },
  },
};
