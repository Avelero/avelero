import type { SectionSchema } from "../registry";

export const IMPACT_SCHEMA: SectionSchema = {
  type: "impact",
  displayName: "Impact",
  allowedZones: ["sidebar"],
  defaultContent: {},
  defaultStyles: {
    title: { typescale: "h6", color: "$foreground" },
    card: { backgroundColor: "$card", borderColor: "$border", borderRadius: 0 },
    "card.icon": { color: "$primary", size: 32 },
    "card.type": { typescale: "body-sm", color: "$mutedForeground" },
    "card.value": { typescale: "h4", color: "$cardForeground" },
    "card.unit": { typescale: "body-sm", color: "$mutedForeground" },
  },
  editorTree: {
    id: "impact",
    displayName: "Impact",
    children: [
      {
        id: "impact.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "title.color", label: "Color" },
          { type: "typescale", path: "title.typescale", label: "Typography" },
        ],
      },
      {
        id: "impact.card",
        displayName: "Card",
        styleFields: [
          { type: "color", path: "card.backgroundColor", label: "Background" },
          { type: "color", path: "card.borderColor", label: "Border Color" },
          { type: "radius", path: "card.borderRadius", label: "Border Radius" },
        ],
      },
      {
        id: "impact.card.icon",
        displayName: "Icon",
        styleFields: [
          { type: "color", path: "card.icon.color", label: "Color" },
          { type: "number", path: "card.icon.size", label: "Size", unit: "px" },
        ],
      },
      {
        id: "impact.card.type",
        displayName: "Type Label",
        styleFields: [
          { type: "color", path: "card.type.color", label: "Color" },
          {
            type: "typescale",
            path: "card.type.typescale",
            label: "Typography",
          },
        ],
      },
      {
        id: "impact.card.value",
        displayName: "Value",
        styleFields: [
          { type: "color", path: "card.value.color", label: "Color" },
          {
            type: "typescale",
            path: "card.value.typescale",
            label: "Typography",
          },
        ],
      },
      {
        id: "impact.card.unit",
        displayName: "Unit",
        styleFields: [
          { type: "color", path: "card.unit.color", label: "Color" },
          {
            type: "typescale",
            path: "card.unit.typescale",
            label: "Typography",
          },
        ],
      },
    ],
  },
};
