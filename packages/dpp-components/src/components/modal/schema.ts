/**
 * Modal fixed component schema.
 *
 * Defines the editor tree and defaults for the passport-level modal building blocks.
 * Each text slot (title, subtitle, description, label, value) is independently stylable.
 */

import {
  CAPITALIZATION_STYLE_OPTIONS,
  SURFACE_CARD_SHADOW,
} from "../../sections/editor-options";
import type { FixedComponentSchema, StyleField } from "../../types/editor";

function createModalTypographyFields(path: string): StyleField[] {
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

export const MODAL_SCHEMA: FixedComponentSchema = {
  id: "modal",
  displayName: "Modal",
  editorTree: {
    id: "modal",
    displayName: "Modal",
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
        id: "modal.container",
        displayName: "Container",
        styleFields: [
          {
            type: "color",
            path: "modal.container.backgroundColor",
            label: "Background",
          },
          {
            type: "toggle",
            path: "modal.container.boxShadow",
            label: "Shadow",
          },
          {
            type: "toggle",
            path: "modal.container.borderWidth",
            label: "Border",
            enabledValue: 1,
            disabledValue: 0,
          },
          {
            type: "color",
            path: "modal.container.borderColor",
            label: "Border Color",
          },
          {
            type: "radius",
            path: "modal.container.borderRadius",
            label: "Border Radius",
          },
        ],
      },
      {
        id: "modal.title",
        displayName: "Title",
        styleFields: createModalTypographyFields("modal.title"),
      },
      {
        id: "modal.subtitle",
        displayName: "Subtitle",
        styleFields: createModalTypographyFields("modal.subtitle"),
      },
      {
        id: "modal.description",
        displayName: "Description",
        styleFields: createModalTypographyFields("modal.description"),
      },
      {
        id: "modal.label",
        displayName: "Label",
        styleFields: createModalTypographyFields("modal.label"),
      },
      {
        id: "modal.value",
        displayName: "Value",
        styleFields: createModalTypographyFields("modal.value"),
      },
      {
        id: "modal.map",
        displayName: "Map",
        styleFields: [
          {
            type: "radius",
            path: "modal.map.borderRadius",
            label: "Border Radius",
          },
          {
            type: "number",
            path: "modal.map.aspectRatio",
            label: "Aspect Ratio",
            step: 0.1,
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
        color: "$mutedLightForeground",
        textTransform: "none",
      },
      "modal.description": {
        typescale: "body",
        color: "$mutedDarkForeground",
        textTransform: "none",
      },
      "modal.label": {
        typescale: "body",
        typographyDetached: true,
        fontWeight: 500,
        color: "$mutedLightForeground",
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
