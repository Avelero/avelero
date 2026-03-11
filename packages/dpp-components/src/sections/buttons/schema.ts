/**
 * Buttons section schema.
 *
 * Defines the editor controls for stacked sidebar action cards.
 */
import { SURFACE_CARD_SHADOW } from "../editor-options";
import type { SectionSchema } from "../registry";

export const BUTTONS_SCHEMA: SectionSchema = {
  type: "buttons",
  displayName: "Buttons",
  allowedZones: ["sidebar"],
  editorTree: {
    id: "buttons",
    displayName: "Buttons",
    configFields: [
      {
        type: "modal",
        path: "menuItems",
        label: "Menu Items",
        modalType: "menu-primary",
      },
    ],
    styleFields: [
      {
        type: "toggle",
        path: "button.boxShadow",
        label: "Shadow",
        enabledValue: SURFACE_CARD_SHADOW,
        disabledValue: "",
      },
      {
        type: "border",
        path: "button.borderWidth",
        label: "Border Width",
      },
      {
        type: "radius",
        path: "button.borderRadius",
        label: "Corner Radius",
      },
    ],
    children: [
      {
        id: "buttons.label",
        displayName: "Label",
        styleFields: [
          { type: "typescale", path: "button.typescale", label: "Typography" },
        ],
      },
      {
        id: "buttons.icon",
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
  defaults: {
    styles: {
      button: {
        typescale: "h6",
        color: "$cardForeground",
        backgroundColor: "$card",
        boxShadow: SURFACE_CARD_SHADOW,
        borderColor: "$border",
        borderRadius: 8,
        borderWidth: 0,
        textTransform: "none",
      },
      "button.icon": { color: "$cardForeground", size: 20 },
    },
    content: {
      variant: "primary",
      menuItems: [
        { label: "Button 1", url: "" },
        { label: "Button 2", url: "" },
        { label: "Button 3", url: "" },
      ],
    },
  },
};
