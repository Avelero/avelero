/**
 * Manufacturer modal schema.
 *
 * Defines the editable building blocks for the manufacturer overview modal.
 * Uses: container, subtitle, title, description, label, value, map.
 */

import {
  CAPITALIZATION_STYLE_OPTIONS,
  SURFACE_CARD_SHADOW,
} from "../../../sections/editor-options";
import type { FixedComponentSchema, StyleField } from "../../../types/editor";

function createTypographyFields(path: string): StyleField[] {
  return [
    { type: "color", path: `${path}.color`, label: "Color" },
    { type: "typescale", path: `${path}.typescale`, label: "Typography" },
    {
      type: "select",
      path: `${path}.textTransform`,
      label: "Capitalization",
      options: [...CAPITALIZATION_STYLE_OPTIONS],
    },
  ];
}

export const MANUFACTURER_MODAL_SCHEMA: FixedComponentSchema = {
  id: "manufacturerModal",
  displayName: "Manufacturer",
  editorTree: {
    id: "manufacturerModal",
    displayName: "Manufacturer Modal",
    configFields: [
      {
        type: "toggle",
        path: "content.showExactLocation",
        label: "Show Exact Location",
        section: "Privacy",
      },
    ],
    children: [
      {
        id: "modal.title",
        displayName: "Title",
        styleFields: createTypographyFields("modal.title"),
      },
      {
        id: "modal.subtitle",
        displayName: "Subtitle",
        styleFields: createTypographyFields("modal.subtitle"),
      },
      {
        id: "modal.description",
        displayName: "Description",
        styleFields: createTypographyFields("modal.description"),
      },
      {
        id: "modal.label",
        displayName: "Label",
        styleFields: createTypographyFields("modal.label"),
      },
      {
        id: "modal.value",
        displayName: "Value",
        styleFields: createTypographyFields("modal.value"),
      },
      {
        id: "modal.map",
        displayName: "Map",
        styleFields: [
          {
            type: "number",
            path: "modal.map.aspectRatio",
            label: "Aspect Ratio",
            step: 0.5,
          },
          {
            type: "radius",
            path: "modal.map.borderRadius",
            label: "Border Radius",
          },
        ],
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
