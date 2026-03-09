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
    children: [
      {
        id: "hero.title",
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
        id: "hero.brand",
        displayName: "Brand",
        styleFields: [
          { type: "color", path: "brand.color", label: "Color" },
          { type: "typescale", path: "brand.typescale", label: "Typography" },
          {
            type: "select",
            path: "brand.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
    ],
  },
  defaults: {
    styles: {
      title: { typescale: "h1", color: "$foreground", textTransform: "none" },
      brand: {
        typescale: "h5",
        color: "$mutedLightForeground",
        textTransform: "none",
      },
    },
    content: {},
  },
};
