/**
 * Separator section schema.
 *
 * Defines the editor controls for the simple divider line.
 */

import type { SectionSchema } from "../registry";

export const SEPARATOR_SCHEMA: SectionSchema = {
  type: "separator",
  displayName: "Divider",
  allowedZones: ["sidebar", "canvas"],
  editorTree: {
    id: "separator",
    displayName: "Divider",
    styleFields: [
      {
        type: "color",
        path: "line.backgroundColor",
        label: "Color",
        section: "Line",
      },
      {
        type: "number",
        path: "line.height",
        label: "Thickness",
        section: "Line",
        unit: "px",
      },
    ],
  },
  defaults: {
    styles: {
      line: { backgroundColor: "$border", height: 1 },
    },
    content: {},
  },
};
