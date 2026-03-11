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
        path: "card.percentage.color",
        label: "Color",
        section: "Percentage",
      },
      {
        type: "typescale",
        path: "card.percentage.typescale",
        label: "Typography",
        section: "Percentage",
      },
      {
        type: "color",
        path: "card.type.color",
        label: "Color",
        section: "Material Type",
      },
      {
        type: "typescale",
        path: "card.type.typescale",
        label: "Typography",
        section: "Material Type",
      },
      {
        type: "select",
        path: "card.type.textTransform",
        label: "Capitalization",
        section: "Material Type",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "card.origin.color",
        label: "Color",
        section: "Location",
      },
      {
        type: "typescale",
        path: "card.origin.typescale",
        label: "Typography",
        section: "Location",
      },
      {
        type: "color",
        path: "card.certification.color",
        label: "Color",
        section: "Certification Type",
      },
      {
        type: "typescale",
        path: "card.certification.typescale",
        label: "Typography",
        section: "Certification Type",
      },
      {
        type: "color",
        path: "card.certification.backgroundColor",
        label: "Background Color",
        section: "Certification Label",
      },
      {
        type: "radius",
        path: "card.certification.borderRadius",
        label: "Corner Radius",
        section: "Certification Label",
      },
      {
        type: "color",
        path: "card.certText.color",
        label: "Color",
        section: "Certification Label",
      },
      {
        type: "typescale",
        path: "card.certText.typescale",
        label: "Typography",
        section: "Certification Label",
      },
      {
        type: "color",
        path: "card.certIcon.color",
        label: "Icon Color",
        section: "Certification Label",
      },
    ],
    configFields: [
      {
        type: "toggle",
        path: "showCertificationCheckIcon",
        label: "Show Check Icon",
        section: "Certification Label",
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
