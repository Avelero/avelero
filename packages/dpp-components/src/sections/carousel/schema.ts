/**
 * Carousel section schema.
 *
 * Defines the editor defaults and style controls for the similar products carousel.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const CAROUSEL_SCHEMA: SectionSchema = {
  type: "carousel",
  displayName: "Similar Products",
  allowedZones: ["canvas"],
  defaultContent: {
    showTitle: true,
    showPrice: true,
    roundPrice: true,
    productCount: 6,
  },
  defaultStyles: {
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
  editorTree: {
    id: "carousel",
    displayName: "Similar Products",
    children: [
      {
        id: "carousel.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "title.color", label: "Color" },
          { type: "typescale", path: "title.typescale", label: "Typography" },
          {
            type: "select",
            path: "title.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "carousel.navButton",
        displayName: "Nav Button",
        styleFields: [
          { type: "color", path: "navButton.color", label: "Icon Color" },
          {
            type: "color",
            path: "navButton.backgroundColor",
            label: "Background",
          },
          {
            type: "color",
            path: "navButton.borderColor",
            label: "Border Color",
          },
        ],
      },
      {
        id: "carousel.productImage",
        displayName: "Product Image",
        styleFields: [
          {
            type: "color",
            path: "productImage.borderColor",
            label: "Border Color",
          },
          {
            type: "radius",
            path: "productImage.borderRadius",
            label: "Border Radius",
          },
        ],
      },
      {
        id: "carousel.productName",
        displayName: "Product Name",
        styleFields: [
          { type: "color", path: "productName.color", label: "Color" },
          {
            type: "typescale",
            path: "productName.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "productName.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [
          { type: "toggle", path: "showTitle", label: "Show Title" },
        ],
      },
      {
        id: "carousel.productPrice",
        displayName: "Product Price",
        styleFields: [
          { type: "color", path: "productPrice.color", label: "Color" },
          {
            type: "typescale",
            path: "productPrice.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "productPrice.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [
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
    ],
  },
};
