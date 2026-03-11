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
        color: "$link",
        textTransform: "none",
      },
      "card.location": {
        typescale: "body",
        color: "$mutedForeground",
        textTransform: "none",
      },
      "card.locationIcon": { color: "$mutedForeground", size: 14 },
      "card.line": { backgroundColor: "$muted" },
      "card.dot": { backgroundColor: "$muted" },
    },
    content: {},
  },
};
