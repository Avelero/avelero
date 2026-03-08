import type { SectionSchema } from "../registry";

export const BUTTONS_SCHEMA: SectionSchema = {
  type: "buttons",
  displayName: "Menu Buttons",
  allowedZones: ["sidebar"],
  defaultContent: {
    variant: "primary",
    menuItems: [],
  },
  defaultStyles: {
    button: {
      typescale: "body-sm",
      color: "$foreground",
      backgroundColor: "$background",
      borderColor: "$border",
    },
    "button.icon": { color: "$foreground", size: 16 },
  },
  editorTree: {
    id: "buttons",
    displayName: "Menu Buttons",
    children: [
      {
        id: "buttons.button",
        displayName: "Button",
        styleFields: [
          { type: "color", path: "button.color", label: "Text Color" },
          {
            type: "color",
            path: "button.backgroundColor",
            label: "Background",
          },
          { type: "color", path: "button.borderColor", label: "Border Color" },
          { type: "typescale", path: "button.typescale", label: "Typography" },
          {
            type: "radius",
            path: "button.borderRadius",
            label: "Border Radius",
          },
          {
            type: "select",
            path: "button.textTransform",
            label: "Case",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
              { value: "lowercase", label: "Lowercase" },
              { value: "capitalize", label: "Capitalize" },
            ],
          },
        ],
        configFields: [
          {
            type: "modal",
            path: "menuItems",
            label: "Menu Items",
            modalType: "menu-primary",
          },
        ],
      },
      {
        id: "buttons.button.icon",
        displayName: "Icon",
        styleFields: [
          { type: "color", path: "button.icon.color", label: "Color" },
          {
            type: "number",
            path: "button.icon.size",
            label: "Size",
            unit: "px",
          },
        ],
      },
    ],
  },
};
