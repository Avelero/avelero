/**
 * Impact modal schema.
 *
 * Defines the editable building blocks for the impact comparison modal.
 * Uses: container, subtitle, title, description + impact-specific elements
 * (tab pills, comparison cards).
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

export const IMPACT_MODAL_SCHEMA: FixedComponentSchema = {
  id: "impactModal",
  displayName: "Impact",
  editorTree: {
    id: "impactModal",
    displayName: "Impact Modal",
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
    },
    content: {
      showExactLocation: true,
    },
  },
};
