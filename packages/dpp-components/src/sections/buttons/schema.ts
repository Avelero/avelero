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
        type: "color",
        path: "button.backgroundColor",
        label: "Background Color",
        section: "Background",
      },
      {
        type: "toggle",
        path: "button.boxShadow",
        label: "Shadow",
        section: "Background",
        enabledValue: SURFACE_CARD_SHADOW,
        disabledValue: "",
      },
      {
        type: "color",
        path: "button.borderColor",
        label: "Border Color",
        section: "Border",
      },
      {
        type: "border",
        path: "button.borderWidth",
        label: "Border Width",
        section: "Border",
      },
      {
        type: "radius",
        path: "button.borderRadius",
        label: "Corner Radius",
        section: "Border",
      },
      {
        type: "typescale",
        path: "button.typescale",
        label: "Typography",
        section: "Label",
      },
      {
        type: "color",
        path: "button.icon.color",
        label: "Color",
        section: "Icon",
      },
      {
        type: "number",
        path: "button.icon.size",
        label: "Size",
        section: "Icon",
        unit: "px",
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
