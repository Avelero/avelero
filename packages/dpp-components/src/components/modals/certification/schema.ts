/**
 * Certification modal schema.
 *
 * Defines the editable building blocks for the certification overview modal.
 */

import {
  CAPITALIZATION_STYLE_OPTIONS,
  SURFACE_CARD_SHADOW,
} from "../../../sections/editor-options";
import type { FixedComponentSchema, StyleField } from "../../../types/editor";

function createTypographyFields(path: string, section: string): StyleField[] {
  return [
    { type: "color", path: `${path}.color`, label: "Color", section },
    {
      type: "typescale",
      path: `${path}.typescale`,
      label: "Typography",
      section,
    },
    {
      type: "select",
      path: `${path}.textTransform`,
      label: "Capitalization",
      section,
      options: [...CAPITALIZATION_STYLE_OPTIONS],
    },
  ];
}

export const CERTIFICATION_MODAL_SCHEMA: FixedComponentSchema = {
  id: "certificationModal",
  displayName: "Certificate",
  editorTree: {
    id: "certificationModal",
    displayName: "Certification Modal",
    styleFields: [
      {
        type: "color",
        path: "modal.container.backgroundColor",
        label: "Background Color",
        section: "Background",
      },
      {
        type: "toggle",
        path: "modal.container.boxShadow",
        label: "Shadow",
        section: "Background",
        enabledValue: SURFACE_CARD_SHADOW,
        disabledValue: "",
      },
      {
        type: "color",
        path: "modal.container.borderColor",
        label: "Border Color",
        section: "Border",
      },
      {
        type: "border",
        path: "modal.container.borderWidth",
        label: "Border Width",
        section: "Border",
      },
      {
        type: "radius",
        path: "modal.container.borderRadius",
        label: "Corner Radius",
        section: "Border",
      },
      ...createTypographyFields("modal.title", "Title"),
      ...createTypographyFields("modal.subtitle", "Subtitle"),
      ...createTypographyFields("modal.description", "Description"),
      ...createTypographyFields("modal.label", "Label"),
      ...createTypographyFields("modal.value", "Value"),
      {
        type: "number",
        path: "modal.map.aspectRatio",
        label: "Aspect Ratio",
        section: "Map",
        step: 0.5,
      },
      {
        type: "radius",
        path: "modal.map.borderRadius",
        label: "Border Radius",
        section: "Map",
      },
    ],
    configFields: [
      {
        type: "toggle",
        path: "content.showExactLocation",
        label: "Show Exact Location",
        section: "Privacy",
      },
    ],
  },
  defaults: {
    styles: {
      "modal.container": {
        backgroundColor: "$card",
        boxShadow: SURFACE_CARD_SHADOW,
        borderColor: "$border",
        borderRadius: 16,
        borderWidth: 0,
      },
      "modal.title": {
        typescale: "h2",
        color: "$foreground",
        textTransform: "none",
      },
      "modal.subtitle": {
        typescale: "h6",
        color: "$mutedForeground",
        textTransform: "none",
      },
      "modal.description": {
        typescale: "body",
        color: "$mutedForeground",
        textTransform: "none",
      },
      "modal.label": {
        typescale: "body",
        typographyDetached: true,
        fontWeight: 500,
        color: "$mutedForeground",
        textTransform: "none",
      },
      "modal.value": {
        typescale: "body",
        color: "$foreground",
        textTransform: "none",
      },
      "modal.map": {
        aspectRatio: 3,
        borderRadius: 10,
      },
    },
    content: {
      showExactLocation: true,
    },
  },
};
