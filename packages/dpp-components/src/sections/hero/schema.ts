/**
 * Hero section schema.
 *
 * Defines the editor controls for the title and brand block.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const HERO_SCHEMA: SectionSchema = {
  type: "hero",
  displayName: "Hero",
  allowedZones: ["sidebar"],
  editorTree: {
    id: "hero",
    displayName: "Hero",
    styleFields: [
      {
        type: "color",
        path: "title.color",
        label: "Color",
        section: "Product Title",
      },
      {
        type: "typescale",
        path: "title.typescale",
        label: "Typography",
        section: "Product Title",
      },
      {
        type: "select",
        path: "title.textTransform",
        label: "Capitalization",
        section: "Product Title",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      { type: "color", path: "brand.color", label: "Color", section: "Brand" },
      {
        type: "typescale",
        path: "brand.typescale",
        label: "Typography",
        section: "Brand",
      },
      {
        type: "select",
        path: "brand.textTransform",
        label: "Capitalization",
        section: "Brand",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
    ],
  },
  defaults: {
    styles: {
      title: { typescale: "h1", color: "$foreground", textTransform: "none" },
      brand: {
        typescale: "h5",
        color: "$mutedForeground",
        textTransform: "none",
      },
    },
    content: {},
  },
};
