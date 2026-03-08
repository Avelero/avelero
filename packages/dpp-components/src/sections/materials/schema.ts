/**
 * Materials section schema.
 *
 * Defines the editor defaults and style controls for the materials breakdown cards.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

const MATERIALS_CARD_SHADOW =
  "0px 0px 2px rgba(0, 0, 0, 0.15), 0px 2px 5px rgba(0, 0, 0, 0.05), 0px 8px 40px rgba(0, 0, 0, 0.04)";

export const MATERIALS_SCHEMA: SectionSchema = {
  type: "materials",
  displayName: "Materials",
  allowedZones: ["sidebar"],
  defaultContent: {
    showCertificationCheckIcon: false,
  },
  defaultStyles: {
    title: { typescale: "h6", color: "$foreground", textTransform: "none" },
    card: {
      backgroundColor: "$card",
      boxShadow: MATERIALS_CARD_SHADOW,
      borderColor: "$border",
      borderRadius: 12,
      borderWidth: 0,
    },
    "card.percentage": {
      typescale: "h6",
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.type": {
      typescale: "h6",
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.origin": {
      typescale: "body",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    "card.locationIcon": { color: "$mutedLightForeground", size: 14 },
    "card.certification": {
      typescale: "body-sm",
      typographyDetached: true,
      lineHeight: 2,
      color: "$cardForeground",
      backgroundColor: "$mutedDark",
      borderRadius: 9999,
      textTransform: "none",
    },
    "card.certIcon": { color: "$cardForeground", size: 14 },
    "card.certText": {
      typescale: "body",
      typographyDetached: true,
      fontWeight: 600,
      color: "$cardForeground",
      textTransform: "none",
    },
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
          {
            type: "select",
            path: "title.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "materials.card",
        displayName: "Card",
        styleFields: [
          { type: "color", path: "card.backgroundColor", label: "Background" },
          { type: "color", path: "card.borderColor", label: "Divider Color" },
          { type: "radius", path: "card.borderRadius", label: "Border Radius" },
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
          {
            type: "select",
            path: "card.percentage.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
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
          {
            type: "select",
            path: "card.type.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
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
          {
            type: "select",
            path: "card.origin.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "materials.card.locationIcon",
        displayName: "Location Icon",
        styleFields: [
          { type: "color", path: "card.locationIcon.color", label: "Color" },
          {
            type: "number",
            path: "card.locationIcon.size",
            label: "Size",
            unit: "px",
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
          {
            type: "typescale",
            path: "card.certification.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.certification.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
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
          {
            type: "select",
            path: "card.certText.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
    ],
  },
};
