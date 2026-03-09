/**
 * Impact section schema.
 *
 * Defines the editor controls for the impact metric cards.
 */
import {
  CAPITALIZATION_STYLE_OPTIONS,
  SURFACE_CARD_SHADOW,
} from "../editor-options";
import type { SectionSchema } from "../registry";

export const IMPACT_SCHEMA: SectionSchema = {
  type: "impact",
  displayName: "Impact",
  allowedZones: ["sidebar"],
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
        displayName: "Help Button",
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
      },
      {
        id: "impact.card",
        displayName: "Card",
        styleFields: [
          { type: "color", path: "card.backgroundColor", label: "Background" },
          {
            type: "toggle",
            path: "card.boxShadow",
            label: "Shadow",
          },
          {
            type: "toggle",
            path: "card.borderWidth",
            label: "Border",
            enabledValue: 1,
            disabledValue: 0,
          },
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
  defaults: {
    styles: {
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
        boxShadow: SURFACE_CARD_SHADOW,
        borderColor: "$border",
        borderRadius: 8,
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
    content: {},
  },
};
