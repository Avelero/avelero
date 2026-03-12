/**
 * Details section schema.
 *
 * Defines the editor controls for the labeled details rows.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const DETAILS_SCHEMA: SectionSchema = {
  type: "details",
  displayName: "Details",
  allowedZones: ["sidebar"],
  editorTree: {
    id: "details",
    displayName: "Details",
    styleFields: [
      {
        type: "color",
        path: "heading.color",
        label: "Color",
        section: "Heading",
      },
      {
        type: "typescale",
        path: "heading.typescale",
        label: "Typography",
        section: "Heading",
      },
      {
        type: "select",
        path: "heading.textTransform",
        label: "Capitalization",
        section: "Heading",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "header.borderColor",
        label: "Border Color",
        section: "Border",
      },
      {
        type: "color",
        path: "row.borderColor",
        label: "Row Border Color",
        section: "Border",
      },
      { type: "color", path: "label.color", label: "Color", section: "Label" },
      {
        type: "typescale",
        path: "label.typescale",
        label: "Typography",
        section: "Label",
      },
      {
        type: "select",
        path: "label.textTransform",
        label: "Capitalization",
        section: "Label",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      { type: "color", path: "value.color", label: "Color", section: "Value" },
      {
        type: "typescale",
        path: "value.typescale",
        label: "Typography",
        section: "Value",
      },
      {
        type: "select",
        path: "value.textTransform",
        label: "Capitalization",
        section: "Value",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
    ],
  },
  defaults: {
    styles: {
      header: { borderColor: "$border" },
      heading: {
        typescale: "h6",
        color: "$foreground",
        textTransform: "none",
      },
      row: { borderColor: "$border" },
      label: {
        typescale: "body",
        typographyDetached: true,
        lineHeight: 1.2,
        color: "$mutedForeground",
        textTransform: "none",
      },
      value: {
        typescale: "body",
        typographyDetached: true,
        lineHeight: 1.2,
        color: "$foreground",
        textTransform: "none",
      },
    },
    content: {},
  },
};
