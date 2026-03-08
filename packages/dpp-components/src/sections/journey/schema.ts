/**
 * Journey section schema.
 *
 * Defines the editor defaults and style controls for the journey timeline cards.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

const JOURNEY_CARD_SHADOW =
  "0px 0px 2px rgba(0, 0, 0, 0.15), 0px 2px 5px rgba(0, 0, 0, 0.05), 0px 8px 40px rgba(0, 0, 0, 0.04)";

export const JOURNEY_SCHEMA: SectionSchema = {
  type: "journey",
  displayName: "Journey",
  allowedZones: ["sidebar"],
  defaultContent: {},
  defaultStyles: {
    title: {
      typescale: "h6",
      typographyDetached: true,
      fontSize: 22,
      fontWeight: 500,
      lineHeight: 1.2,
      color: "$foreground",
      textTransform: "none",
    },
    card: {
      backgroundColor: "$card",
      boxShadow: JOURNEY_CARD_SHADOW,
      borderColor: "$border",
      borderRadius: 12,
      borderWidth: 0,
    },
    "card.type": {
      typescale: "h5",
      typographyDetached: true,
      fontSize: 26,
      fontWeight: 500,
      lineHeight: 1.15,
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.operator": {
      typescale: "body",
      typographyDetached: true,
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 1.3,
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.location": {
      typescale: "body",
      typographyDetached: true,
      fontSize: 18,
      fontWeight: 400,
      lineHeight: 1.3,
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    "card.locationIcon": { color: "$mutedLightForeground", size: 18 },
    "card.line": { backgroundColor: "$border" },
    "card.dot": { backgroundColor: "$border" },
  },
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
          { type: "color", path: "card.borderColor", label: "Divider Color" },
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
};
