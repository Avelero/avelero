/**
 * Header fixed component schema.
 *
 * Defines the editor tree and defaults for the header (logo + text logo).
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../../../sections/editor-options";
import type { FixedComponentSchema } from "../../../types/editor";

export const HEADER_SCHEMA: FixedComponentSchema = {
  id: "header",
  displayName: "Header",
  editorTree: {
    id: "header",
    displayName: "Header",
    configFields: [{ type: "image", path: "logoUrl", label: "Logo" }],
    children: [
      {
        id: "header.textLogo",
        displayName: "Text Logo",
        styleFields: [
          { type: "color", path: "textLogo.color", label: "Color" },
          {
            type: "typescale",
            path: "textLogo.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "textLogo.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
    ],
  },
  defaults: {
    styles: {
      container: { backgroundColor: "$background", borderColor: "$border" },
      textLogo: { color: "$foreground", textTransform: "none" },
    },
    content: {
      logoUrl: "",
    },
  },
};
