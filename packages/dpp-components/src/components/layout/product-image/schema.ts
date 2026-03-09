/**
 * Product image fixed component schema.
 *
 * Defines the editor tree and defaults for the product image frame.
 */
import type { FixedComponentSchema } from "../../../types/editor";

export const PRODUCT_IMAGE_SCHEMA: FixedComponentSchema = {
  id: "productImage",
  displayName: "Product Image",
  editorTree: {
    id: "productImage",
    displayName: "Product Image",
    styleFields: [
      {
        type: "color",
        path: "frame.borderColor",
        label: "Border Color",
      },
      {
        type: "border",
        path: "frame.borderWidth",
        label: "Border Width",
      },
      {
        type: "radius",
        path: "frame.borderRadius",
        label: "Border Radius",
      },
    ],
  },
  defaults: {
    styles: {
      frame: {
        borderColor: "$border",
        borderWidth: 0,
        borderRadius: 4,
      },
    },
    content: {},
  },
};
