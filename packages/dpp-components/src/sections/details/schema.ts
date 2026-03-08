/**
 * Details section schema.
 *
 * Defines the editor defaults and style controls for the labeled details rows.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const DETAILS_SCHEMA: SectionSchema = {
  type: "details",
  displayName: "Details",
  allowedZones: ["sidebar"],
  defaultContent: {},
  defaultStyles: {
    header: { borderColor: "$border" },
    heading: { typescale: "h6", color: "$foreground", textTransform: "none" },
    row: { borderColor: "$border" },
    label: {
      typescale: "body",
      typographyDetached: true,
      lineHeight: 1.2,
      color: "$mutedLightForeground",
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
  editorTree: {
    id: "details",
    displayName: "Details",
    children: [
      {
        id: "details.header",
        displayName: "Header",
        styleFields: [
          {
            type: "color",
            path: "header.borderColor",
            label: "Border Color",
          },
        ],
      },
      {
        id: "details.heading",
        displayName: "Heading",
        styleFields: [
          { type: "color", path: "heading.color", label: "Color" },
          {
            type: "typescale",
            path: "heading.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "heading.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "details.row",
        displayName: "Rows",
        styleFields: [
          {
            type: "color",
            path: "row.borderColor",
            label: "Border Color",
          },
        ],
      },
      {
        id: "details.label",
        displayName: "Label",
        styleFields: [
          { type: "color", path: "label.color", label: "Color" },
          { type: "typescale", path: "label.typescale", label: "Typography" },
          {
            type: "select",
            path: "label.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "details.value",
        displayName: "Value",
        styleFields: [
          { type: "color", path: "value.color", label: "Color" },
          { type: "typescale", path: "value.typescale", label: "Typography" },
          {
            type: "select",
            path: "value.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
    ],
  },
};
