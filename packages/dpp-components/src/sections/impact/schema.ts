/**
 * Impact section schema.
 *
 * Defines the editor defaults and style controls for the impact metric cards.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

const IMPACT_CARD_SHADOW =
  "0px 0px 2px rgba(0, 0, 0, 0.15), 0px 2px 5px rgba(0, 0, 0, 0.05), 0px 8px 40px rgba(0, 0, 0, 0.04)";

export const IMPACT_SCHEMA: SectionSchema = {
  type: "impact",
  displayName: "Impact",
  allowedZones: ["sidebar"],
  defaultContent: {
    helpText: "What does this mean?",
    helpUrl: "https://avelero.com/",
  },
  defaultStyles: {
    title: {
      typescale: "h6",
      color: "$foreground",
      textTransform: "none",
    },
    helpLink: {
      typescale: "body",
      typographyDetached: true,
      fontWeight: 500,
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    card: {
      backgroundColor: "$card",
      boxShadow: IMPACT_CARD_SHADOW,
      borderRadius: 12,
      borderWidth: 0,
    },
    "card.icon": { color: "$primary", size: 28 },
    "card.type": {
      typescale: "body-sm",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    "card.value": {
      typescale: "h1",
      typographyDetached: true,
      fontWeight: 500,
      lineHeight: 1,
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.unit": {
      typescale: "body-sm",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
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
          {
            type: "select",
            path: "title.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "impact.helpLink",
        displayName: "Help Link",
        styleFields: [
          { type: "color", path: "helpLink.color", label: "Color" },
          {
            type: "typescale",
            path: "helpLink.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "helpLink.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [
          { type: "text", path: "helpText", label: "Text" },
          { type: "url", path: "helpUrl", label: "URL" },
        ],
      },
      {
        id: "impact.card",
        displayName: "Card",
        styleFields: [
          { type: "color", path: "card.backgroundColor", label: "Background" },
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
          {
            type: "select",
            path: "card.type.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
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
          {
            type: "select",
            path: "card.value.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
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
          {
            type: "select",
            path: "card.unit.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
    ],
  },
};
