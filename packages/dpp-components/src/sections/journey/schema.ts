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
    styleFields: [
      {
        type: "color",
        path: "title.color",
        label: "Color",
        section: "Heading",
      },
      {
        type: "typescale",
        path: "title.typescale",
        label: "Typography",
        section: "Heading",
      },
      {
        type: "select",
        path: "title.textTransform",
        label: "Capitalization",
        section: "Heading",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "card.backgroundColor",
        label: "Background Color",
        section: "Background",
      },
      {
        type: "toggle",
        path: "card.boxShadow",
        label: "Shadow",
        section: "Background",
        enabledValue: SURFACE_CARD_SHADOW,
        disabledValue: "",
      },
      {
        type: "color",
        path: "card.borderColor",
        label: "Border Color",
        section: "Border",
      },
      {
        type: "border",
        path: "card.borderWidth",
        label: "Border Width",
        section: "Border",
      },
      {
        type: "radius",
        path: "card.borderRadius",
        label: "Corner Radius",
        section: "Border",
      },
      {
        type: "color",
        path: "card.type.color",
        label: "Color",
        section: "Stage Name",
      },
      {
        type: "typescale",
        path: "card.type.typescale",
        label: "Typography",
        section: "Stage Name",
      },
      {
        type: "select",
        path: "card.type.textTransform",
        label: "Capitalization",
        section: "Stage Name",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "card.operator.color",
        label: "Color",
        section: "Operator Name",
      },
      {
        type: "typescale",
        path: "card.operator.typescale",
        label: "Typography",
        section: "Operator Name",
      },
      {
        type: "color",
        path: "card.location.color",
        label: "Color",
        section: "Location",
      },
      {
        type: "typescale",
        path: "card.location.typescale",
        label: "Typography",
        section: "Location",
      },
      {
        type: "color",
        path: "card.line.backgroundColor",
        label: "Color",
        section: "Timeline",
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
    },
    content: {},
  },
};
