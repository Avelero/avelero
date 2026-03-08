/**
 * Buttons section schema.
 *
 * Defines the editor defaults and style controls for stacked sidebar action cards.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

const DEFAULT_MENU_ITEMS = [
  { label: "Care instructions", url: "https://avelero.com/" },
  { label: "Recycling & Repair", url: "https://avelero.com/" },
  { label: "Warranty", url: "https://avelero.com/" },
];

export const BUTTONS_SCHEMA: SectionSchema = {
  type: "buttons",
  displayName: "Menu Buttons",
  allowedZones: ["sidebar"],
  defaultContent: {
    variant: "primary",
    menuItems: DEFAULT_MENU_ITEMS,
  },
  defaultStyles: {
    button: {
      typescale: "h6",
      color: "$cardForeground",
      backgroundColor: "$card",
      boxShadow:
        "0px 0px 2px rgba(0, 0, 0, 0.15), 0px 2px 5px rgba(0, 0, 0, 0.05), 0px 8px 40px rgba(0, 0, 0, 0.04)",
      borderRadius: 12,
      borderWidth: 0,
      textTransform: "none",
    },
    "button.icon": { color: "$cardForeground", size: 20 },
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
