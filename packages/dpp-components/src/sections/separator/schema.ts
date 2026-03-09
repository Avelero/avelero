/**
 * Separator section schema.
 *
 * Defines the editor controls for the simple divider line.
 */

import type { SectionSchema } from "../registry";

export const SEPARATOR_SCHEMA: SectionSchema = {
  type: "separator",
  displayName: "Separator",
  allowedZones: ["sidebar", "canvas"],
  editorTree: {
    id: "separator",
    displayName: "Separator",
    styleFields: [
      {
        type: "color",
        path: "line.backgroundColor",
        label: "Color",
      },
    ],
  },
  defaults: {
    styles: {
      line: { backgroundColor: "$border" },
    },
    content: {},
  },
};
