/**
 * Materials section schema.
 *
 * Defines the editor controls for the materials breakdown cards.
 */
import {
  CAPITALIZATION_STYLE_OPTIONS,
  SURFACE_CARD_SHADOW,
} from "../editor-options";
import type { SectionSchema } from "../registry";

export const MATERIALS_SCHEMA: SectionSchema = {
  type: "materials",
  displayName: "Materials",
  allowedZones: ["sidebar"],
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
        ],
      },
      {
        id: "materials.card.certification",
        displayName: "Certification Badge",
        styleFields: [
          {
            type: "color",
            path: "card.certification.color",
            label: "Color",
          },
          {
            type: "typescale",
            path: "card.certification.typescale",
            label: "Typography",
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
  defaults: {
    styles: {
      title: { typescale: "h6", color: "$foreground", textTransform: "none" },
      card: {
        backgroundColor: "$card",
        boxShadow: SURFACE_CARD_SHADOW,
        borderColor: "$border",
        borderRadius: 8,
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
        color: "$mutedForeground",
        textTransform: "none",
      },
      "card.locationIcon": { color: "$mutedForeground", size: 14 },
      "card.certification": {
        typescale: "body-sm",
        typographyDetached: true,
        lineHeight: 2,
        color: "$cardForeground",
        backgroundColor: "$muted",
        borderRadius: 9999,
        textTransform: "none",
      },
      "card.certIcon": { color: "$cardForeground", size: 14 },
      "card.certText": {
        typescale: "body",
        typographyDetached: true,
        fontWeight: 500,
        color: "$link",
        textTransform: "none",
      },
    },
    content: {
      showCertificationCheckIcon: false,
    },
  },
};
