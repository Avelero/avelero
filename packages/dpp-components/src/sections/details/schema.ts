import type { SectionSchema } from "../registry";

export const DETAILS_SCHEMA: SectionSchema = {
  type: "details",
  displayName: "Product Details",
  allowedZones: ["sidebar"],
  defaultContent: {},
  defaultStyles: {
    container: { borderColor: "$border" },
    label: { typescale: "body-sm", color: "$foreground" },
    value: { typescale: "body-sm", color: "$foreground" },
  },
  editorTree: {
    id: "details",
    displayName: "Product Details",
    children: [
      {
        id: "details.container",
        displayName: "Container",
        styleFields: [
          {
            type: "color",
            path: "container.borderColor",
            label: "Border Color",
          },
          {
            type: "radius",
            path: "container.borderRadius",
            label: "Border Radius",
          },
        ],
      },
      {
        id: "details.label",
        displayName: "Label",
        styleFields: [
          { type: "color", path: "label.color", label: "Color" },
          { type: "typescale", path: "label.typescale", label: "Typography" },
        ],
      },
      {
        id: "details.value",
        displayName: "Value",
        styleFields: [
          { type: "color", path: "value.color", label: "Color" },
          { type: "typescale", path: "value.typescale", label: "Typography" },
        ],
      },
    ],
  },
};
