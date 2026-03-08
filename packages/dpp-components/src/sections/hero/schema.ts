import type { SectionSchema } from "../registry";

export const HERO_SCHEMA: SectionSchema = {
  type: "hero",
  displayName: "Product Description",
  allowedZones: ["sidebar"],
  defaultContent: {},
  defaultStyles: {
    brand: {
      typescale: "body-sm",
      color: "$mutedForeground",
      textTransform: "uppercase",
    },
    title: { typescale: "h3" },
    description: { typescale: "body", color: "$foreground" },
    showMore: {
      typescale: "body-xs",
      color: "$mutedForeground",
      textTransform: "uppercase",
    },
  },
  editorTree: {
    id: "hero",
    displayName: "Product Description",
    children: [
      {
        id: "hero.brand",
        displayName: "Brand",
        styleFields: [
          { type: "color", path: "brand.color", label: "Color" },
          { type: "typescale", path: "brand.typescale", label: "Typography" },
          {
            type: "select",
            path: "brand.textTransform",
            label: "Case",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
              { value: "lowercase", label: "Lowercase" },
              { value: "capitalize", label: "Capitalize" },
            ],
          },
        ],
      },
      {
        id: "hero.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "title.color", label: "Color" },
          { type: "typescale", path: "title.typescale", label: "Typography" },
        ],
      },
      {
        id: "hero.description",
        displayName: "Description",
        styleFields: [
          { type: "color", path: "description.color", label: "Color" },
          {
            type: "typescale",
            path: "description.typescale",
            label: "Typography",
          },
        ],
      },
      {
        id: "hero.showMore",
        displayName: "Show More",
        styleFields: [
          { type: "color", path: "showMore.color", label: "Color" },
          {
            type: "typescale",
            path: "showMore.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "showMore.textTransform",
            label: "Case",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
              { value: "lowercase", label: "Lowercase" },
              { value: "capitalize", label: "Capitalize" },
            ],
          },
        ],
      },
    ],
  },
};
