/**
 * Description section schema.
 *
 * Defines the editor controls for the clamped description preview.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import { createModalSchemaGroup } from "../modal-schema";
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
        path: "header.borderColor",
        label: "Border Color",
      },
    ],
    children: [
      {
        id: "description.heading",
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
        id: "description.body",
        displayName: "Body",
        styleFields: [
          { type: "color", path: "body.color", label: "Color" },
          { type: "typescale", path: "body.typescale", label: "Typography" },
          {
            type: "select",
            path: "body.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "description.showMore",
        displayName: "Show More",
        styleFields: [
          { type: "color", path: "showMore.color", label: "Color" },
          {
            type: "typescale",
            path: "showMore.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "showMore.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      createModalSchemaGroup("description"),
    ],
  },
};
