/**
 * Journey section schema.
 *
 * Defines the editor controls for the journey timeline cards.
 */
import {
  CAPITALIZATION_STYLE_OPTIONS,
  SURFACE_CARD_SHADOW,
} from "../editor-options";
import type { SectionSchema } from "../registry";

export const JOURNEY_SCHEMA: SectionSchema = {
  type: "journey",
  displayName: "Journey",
  allowedZones: ["sidebar"],
  editorTree: {
    id: "journey",
    displayName: "Journey",
    children: [
      {
        id: "journey.title",
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
        id: "journey.card",
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
          {
            type: "color",
            path: "card.borderColor",
            label: "Border / Divider Color",
          },
          { type: "radius", path: "card.borderRadius", label: "Border Radius" },
        ],
      },
      {
        id: "journey.card.type",
        displayName: "Stage Name",
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
        id: "journey.card.operator",
        displayName: "Operator Name",
        styleFields: [
          { type: "color", path: "card.operator.color", label: "Color" },
          {
            type: "typescale",
            path: "card.operator.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.operator.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "journey.card.location",
        displayName: "Location",
        styleFields: [
          { type: "color", path: "card.location.color", label: "Color" },
          {
            type: "typescale",
            path: "card.location.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.location.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "journey.card.locationIcon",
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
        id: "journey.card.line",
        displayName: "Timeline Line",
        styleFields: [
          { type: "color", path: "card.line.backgroundColor", label: "Color" },
        ],
      },
      {
        id: "journey.card.dot",
        displayName: "Timeline Dot",
        styleFields: [
          { type: "color", path: "card.dot.backgroundColor", label: "Color" },
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
      card: {
        backgroundColor: "$card",
        boxShadow: SURFACE_CARD_SHADOW,
        borderColor: "$border",
        borderRadius: 8,
        borderWidth: 0,
      },
      "card.type": {
        typescale: "h6",
        color: "$cardForeground",
        textTransform: "none",
      },
      "card.operator": {
        typescale: "body",
        typographyDetached: true,
        fontWeight: 500,
        color: "$cardForeground",
        textTransform: "none",
      },
      "card.location": {
        typescale: "body",
        color: "$mutedLightForeground",
        textTransform: "none",
      },
      "card.locationIcon": { color: "$mutedLightForeground", size: 14 },
      "card.line": { backgroundColor: "$mutedLight" },
      "card.dot": { backgroundColor: "$mutedLight" },
    },
    content: {},
  },
};
