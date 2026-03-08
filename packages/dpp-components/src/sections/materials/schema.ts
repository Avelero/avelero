import type { SectionSchema } from "../registry";

export const MATERIALS_SCHEMA: SectionSchema = {
  type: "materials",
  displayName: "Materials",
  allowedZones: ["sidebar"],
  defaultContent: {
    showCertificationCheckIcon: true,
  },
  defaultStyles: {
    title: { typescale: "h6", color: "$foreground" },
    card: { borderColor: "$border" },
    "card.percentage": { typescale: "h5", color: "$foreground" },
    "card.type": { typescale: "body-sm", color: "$foreground" },
    "card.origin": { typescale: "body-xs", color: "$mutedForeground" },
    "card.certification": {
      typescale: "body-xs",
      color: "$successForeground",
      backgroundColor: "$success",
      borderRadius: 2,
    },
    "card.certIcon": { color: "$successForeground", size: 12 },
    "card.certText": { typescale: "body-xs", color: "$mutedForeground" },
  },
  editorTree: {
    id: "materials",
    displayName: "Materials",
    children: [
      {
        id: "materials.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "title.color", label: "Color" },
          { type: "typescale", path: "title.typescale", label: "Typography" },
        ],
      },
      {
        id: "materials.card",
        displayName: "Card",
        styleFields: [
          { type: "color", path: "card.borderColor", label: "Border Color" },
        ],
      },
      {
        id: "materials.card.percentage",
        displayName: "Percentage",
        styleFields: [
          { type: "color", path: "card.percentage.color", label: "Color" },
          {
            type: "typescale",
            path: "card.percentage.typescale",
            label: "Typography",
          },
        ],
      },
      {
        id: "materials.card.type",
        displayName: "Material Type",
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
        id: "materials.card.origin",
        displayName: "Origin",
        styleFields: [
          { type: "color", path: "card.origin.color", label: "Color" },
          {
            type: "typescale",
            path: "card.origin.typescale",
            label: "Typography",
          },
        ],
      },
      {
        id: "materials.card.certification",
        displayName: "Certification Badge",
        styleFields: [
          {
            type: "color",
            path: "card.certification.color",
            label: "Text Color",
          },
          {
            type: "color",
            path: "card.certification.backgroundColor",
            label: "Background",
          },
          {
            type: "radius",
            path: "card.certification.borderRadius",
            label: "Border Radius",
          },
        ],
        configFields: [
          {
            type: "toggle",
            path: "showCertificationCheckIcon",
            label: "Show Check Icon",
          },
        ],
      },
      {
        id: "materials.card.certIcon",
        displayName: "Cert Icon",
        styleFields: [
          { type: "color", path: "card.certIcon.color", label: "Color" },
          {
            type: "number",
            path: "card.certIcon.size",
            label: "Size",
            unit: "px",
          },
        ],
      },
      {
        id: "materials.card.certText",
        displayName: "Certification Text",
        styleFields: [
          { type: "color", path: "card.certText.color", label: "Color" },
          {
            type: "typescale",
            path: "card.certText.typescale",
            label: "Typography",
          },
        ],
      },
    ],
  },
};
