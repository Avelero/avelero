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
        path: "helpLink.color",
        label: "Color",
        section: "Info Button",
      },
      {
        type: "typescale",
        path: "helpLink.typescale",
        label: "Typography",
        section: "Info Button",
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
        section: "Metric Type",
      },
      {
        type: "typescale",
        path: "card.type.typescale",
        label: "Typography",
        section: "Metric Type",
      },
      {
        type: "select",
        path: "card.type.textTransform",
        label: "Capitalization",
        section: "Metric Type",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "card.value.color",
        label: "Color",
        section: "Metric Value",
      },
      {
        type: "typescale",
        path: "card.value.typescale",
        label: "Typography",
        section: "Metric Value",
      },
      {
        type: "color",
        path: "card.unit.color",
        label: "Color",
        section: "Metric Unit",
      },
      {
        type: "typescale",
        path: "card.unit.typescale",
        label: "Typography",
        section: "Metric Unit",
      },
      {
        type: "color",
        path: "card.carbonIcon.color",
        label: "Color",
        section: "Carbon Icon",
      },
      {
        type: "color",
        path: "card.waterIcon.color",
        label: "Color",
        section: "Water Icon",
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
        color: "$link",
        textTransform: "none",
      },
      card: {
        backgroundColor: "$card",
        boxShadow: SURFACE_CARD_SHADOW,
        borderColor: "$border",
        borderRadius: 8,
        borderWidth: 0,
      },
      "card.icon": { size: 28 },
      "card.carbonIcon": { color: "#10A651" },
      "card.waterIcon": { color: "#1616F3" },
      "card.type": {
        typescale: "body-sm",
        color: "$mutedForeground",
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
        color: "$mutedForeground",
        textTransform: "none",
      },
    },
    content: {},
  },
};
