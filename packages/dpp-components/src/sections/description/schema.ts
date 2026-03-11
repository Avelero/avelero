/**
 * Description section schema.
 *
 * Defines the editor controls for the clamped description preview.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const DESCRIPTION_SCHEMA: SectionSchema = {
  type: "description",
  displayName: "Description",
  allowedZones: ["sidebar"],
  editorTree: {
    id: "description",
    displayName: "Description",
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
        path: "body.color",
        label: "Color",
        section: "Description",
      },
      {
        type: "typescale",
        path: "body.typescale",
        label: "Typography",
        section: "Description",
      },
      {
        type: "select",
        path: "body.textTransform",
        label: "Capitalization",
        section: "Description",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "showMore.color",
        label: "Color",
        section: "Show More",
      },
      {
        type: "typescale",
        path: "showMore.typescale",
        label: "Typography",
        section: "Show More",
      },
      {
        type: "select",
        path: "showMore.textTransform",
        label: "Capitalization",
        section: "Show More",
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
      body: {
        typescale: "body",
        color: "$mutedForeground",
        textTransform: "none",
      },
      showMore: {
        typescale: "body",
        typographyDetached: true,
        fontWeight: 600,
        color: "$foreground",
        textTransform: "none",
      },
    },
    content: {},
  },
};
