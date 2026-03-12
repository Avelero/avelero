/**
 * Shared modal schema.
 *
 * Defines the single editable modal target used by the theme editor.
 * It exposes the union of the shared modal slots used across the
 * description, impact, manufacturer, certification, and operator modals.
 */

import {
  CAPITALIZATION_STYLE_OPTIONS,
  SURFACE_CARD_SHADOW,
} from "../../sections/editor-options";
import type { FixedComponentSchema, StyleField } from "../../types/editor";

function createTypographyFields(path: string, section: string): StyleField[] {
  // Reuse the shared typography controls for each modal text slot.
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

export const SHARED_MODAL_SCHEMA: FixedComponentSchema = {
  id: "modal",
  displayName: "Modal",
  editorTree: {
    id: "modal",
    displayName: "Modal",
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
      ...createTypographyFields("modal.link", "Link"),
      {
        type: "color",
        path: "modal.footerButton.backgroundColor",
        label: "Background Color",
        section: "Footer Button",
      },
      {
        type: "color",
        path: "modal.footerButton.borderColor",
        label: "Border Color",
        section: "Footer Button",
      },
      {
        type: "border",
        path: "modal.footerButton.borderWidth",
        label: "Border Width",
        section: "Footer Button",
      },
      {
        type: "radius",
        path: "modal.footerButton.borderRadius",
        label: "Corner Radius",
        section: "Footer Button",
      },
      ...createTypographyFields("modal.footerButton", "Footer Button"),
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
      "modal.link": {
        typescale: "body",
        typographyDetached: true,
        fontWeight: 500,
        color: "$link",
        textTransform: "none",
      },
      "modal.footerButton": {
        typescale: "body",
        typographyDetached: true,
        fontWeight: 500,
        color: "$card",
        backgroundColor: "$foreground",
        borderColor: "$foreground",
        borderRadius: 9999,
        borderWidth: 0,
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
