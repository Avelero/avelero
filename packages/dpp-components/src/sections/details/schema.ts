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
    children: [
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
