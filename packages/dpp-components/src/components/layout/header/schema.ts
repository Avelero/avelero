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
        type: "color",
        path: "textLogo.color",
        label: "Color",
        section: "Text Logo",
      },
      {
        type: "typescale",
        path: "textLogo.typescale",
        label: "Typography",
        section: "Text Logo",
      },
      {
        type: "select",
        path: "textLogo.textTransform",
        label: "Capitalization",
        section: "Text Logo",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
    ],
    configFields: [{ type: "image", path: "logoUrl", label: "Logo" }],
  },
  defaults: {
    styles: {
      container: {
        backgroundColor: "$background",
        borderColor: "$border",
        borderWidth: 0,
      },
      textLogo: { color: "$foreground", textTransform: "none" },
    },
    content: {
      logoUrl: "",
    },
  },
};
