/**
 * Banner section schema.
 *
 * Defines the editor controls for the CTA banner and button.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const BANNER_SCHEMA: SectionSchema = {
  type: "banner",
  displayName: "Banner",
  allowedZones: ["canvas"],
  editorTree: {
    id: "banner",
    displayName: "Banner",
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
        type: "radius",
        path: "container.borderRadius",
        label: "Corner Radius",
        section: "Border",
      },
      {
        type: "color",
        path: "headline.color",
        label: "Color",
        section: "Headline",
      },
      {
        type: "typescale",
        path: "headline.typescale",
        label: "Typography",
        section: "Headline",
      },
      {
        type: "select",
        path: "headline.textAlign",
        label: "Alignment",
        section: "Headline",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
      },
      {
        type: "select",
        path: "headline.textTransform",
        label: "Capitalization",
        section: "Headline",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "subline.color",
        label: "Color",
        section: "Subline",
      },
      {
        type: "typescale",
        path: "subline.typescale",
        label: "Typography",
        section: "Subline",
      },
      {
        type: "select",
        path: "subline.textAlign",
        label: "Alignment",
        section: "Subline",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
      },
      {
        type: "select",
        path: "subline.textTransform",
        label: "Capitalization",
        section: "Subline",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "button.color",
        label: "Text Color",
        section: "Button",
      },
      {
        type: "typescale",
        path: "button.typescale",
        label: "Typography",
        section: "Button",
      },
      {
        type: "select",
        path: "button.textTransform",
        label: "Capitalization",
        section: "Button",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "button.backgroundColor",
        label: "Background Color",
        section: "Button",
      },
      {
        type: "color",
        path: "button.borderColor",
        label: "Border Color",
        section: "Button",
      },
      {
        type: "border",
        path: "button.borderWidth",
        label: "Border Width",
        section: "Button",
      },
      {
        type: "radius",
        path: "button.borderRadius",
        label: "Corner Radius",
        section: "Button",
      },
    ],
    configFields: [
      { type: "image", path: "backgroundImage", label: "Background Image" },
      { type: "textarea", path: "headline", label: "Headline Text" },
      { type: "textarea", path: "subline", label: "Subline Text" },
      { type: "text", path: "ctaText", label: "Button Text" },
      { type: "url", path: "ctaUrl", label: "Button URL" },
    ],
  },
  defaults: {
    styles: {
      container: {
        backgroundColor: "$primary",
        borderColor: "$border",
        borderRadius: 4,
        borderWidth: 0,
      },
      headline: {
        typescale: "h2",
        color: "$foreground",
        textAlign: "center",
        textTransform: "none",
      },
      subline: {
        typescale: "body",
        color: "$foreground",
        textAlign: "center",
        textTransform: "none",
      },
      button: {
        typescale: "body-sm",
        color: "$foreground",
        backgroundColor: "$background",
        borderColor: "$primaryForeground",
        borderRadius: 99,
        borderWidth: 1,
        textTransform: "none",
      },
    },
    content: {
      headline: "Heading",
      subline:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.",
      ctaText: "",
      ctaUrl: "",
      backgroundImage: "",
    },
  },
};
