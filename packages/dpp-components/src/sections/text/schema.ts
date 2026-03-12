/**
 * Text section schema.
 *
 * Defines the editor controls for the canvas-only single text block.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

const DEFAULT_TEXT_BODY =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

export const TEXT_SCHEMA: SectionSchema = {
  type: "text",
  displayName: "Text",
  allowedZones: ["canvas"],
  editorTree: {
    id: "text",
    displayName: "Text",
    styleFields: [
      {
        type: "color",
        path: "container.backgroundColor",
        label: "Background Color",
        section: "Background",
      },
      {
        type: "color",
        path: "container.borderColor",
        label: "Border Color",
        section: "Border",
      },
      {
        type: "border",
        path: "container.borderWidth",
        label: "Border Width",
        section: "Border",
      },
      {
        type: "radius",
        path: "container.borderRadius",
        label: "Corner Radius",
        section: "Border",
      },
      { type: "color", path: "body.color", label: "Color", section: "Text" },
      {
        type: "typescale",
        path: "body.typescale",
        label: "Typography",
        section: "Text",
      },
      {
        type: "select",
        path: "body.textAlign",
        label: "Alignment",
        section: "Text",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
      },
      {
        type: "select",
        path: "body.textTransform",
        label: "Capitalization",
        section: "Text",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
    ],
    configFields: [{ type: "textarea", path: "body", label: "Text" }],
  },
  defaults: {
    styles: {
      container: {},
      body: {
        typescale: "body",
        color: "$foreground",
        textAlign: "left",
        textTransform: "none",
      },
    },
    content: {
      body: DEFAULT_TEXT_BODY,
    },
  },
};
