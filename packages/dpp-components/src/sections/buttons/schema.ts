/**
 * Buttons section schema.
 *
 * Defines the editor controls for stacked sidebar action cards.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const BUTTONS_SCHEMA: SectionSchema = {
  type: "buttons",
  displayName: "Menu Buttons",
  allowedZones: ["sidebar"],
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
          {
            type: "toggle",
            path: "button.boxShadow",
            label: "Shadow",
          },
          {
            type: "toggle",
            path: "button.borderWidth",
            label: "Border",
            enabledValue: 1,
            disabledValue: 0,
          },
          {
            type: "color",
            path: "button.borderColor",
            label: "Border Color",
          },
          { type: "typescale", path: "button.typescale", label: "Typography" },
          {
            type: "radius",
            path: "button.borderRadius",
            label: "Border Radius",
          },
          {
            type: "select",
            path: "button.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
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
