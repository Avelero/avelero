/**
 * Text and image section schema.
 *
 * Defines the editor controls for the full-width canvas feature block.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

const DEFAULT_TEXT_IMAGE_BODY =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

export const TEXT_IMAGE_SCHEMA: SectionSchema = {
  type: "textImage",
  displayName: "Image With Text",
  allowedZones: ["canvas"],
  editorTree: {
    id: "textImage",
    displayName: "Image With Text",
    styleFields: [
      {
        type: "color",
        path: "heading.color",
        label: "Color",
        section: "Heading",
      },
      {
        type: "typescale",
        path: "heading.typescale",
        label: "Typography",
        section: "Heading",
      },
      {
        type: "select",
        path: "heading.textTransform",
        label: "Capitalization",
        section: "Heading",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      { type: "color", path: "body.color", label: "Color", section: "Body" },
      {
        type: "typescale",
        path: "body.typescale",
        label: "Typography",
        section: "Body",
      },
      {
        type: "select",
        path: "body.textTransform",
        label: "Capitalization",
        section: "Body",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "image.borderColor",
        label: "Border Color",
        section: "Image Border",
      },
      {
        type: "border",
        path: "image.borderWidth",
        label: "Border Width",
        section: "Image Border",
      },
      {
        type: "radius",
        path: "image.borderRadius",
        label: "Corner Radius",
        section: "Image Border",
      },
    ],
    configFields: [
      { type: "textarea", path: "headline", label: "Heading Text" },
      { type: "textarea", path: "body", label: "Body Text" },
      { type: "image", path: "image", label: "Image" },
      { type: "text", path: "imageAlt", label: "Image Alt Text" },
      {
        type: "select",
        path: "imagePosition",
        label: "Desktop Image Side",
        options: [
          { value: "right", label: "Right" },
          { value: "left", label: "Left" },
        ],
      },
      {
        type: "select",
        path: "mobileLayout",
        label: "Mobile Layout",
        options: [
          { value: "split", label: "Heading / Image / Body" },
          { value: "imageFirst", label: "Image / Heading / Body" },
          { value: "textFirst", label: "Heading / Body / Image" },
        ],
      },
    ],
  },
  defaults: {
    styles: {
      container: {},
      heading: {
        typescale: "h2",
        color: "$foreground",
        textTransform: "none",
      },
      body: {
        typescale: "body",
        color: "$mutedForeground",
        textTransform: "none",
      },
      image: {
        aspectRatio: 1,
        borderColor: "$border",
        borderRadius: 4,
        borderWidth: 0,
      },
    },
    content: {
      headline: "Heading",
      body: DEFAULT_TEXT_IMAGE_BODY,
      image: "",
      imageAlt: "Placeholder image",
      imagePosition: "right",
      mobileLayout: "split",
    },
  },
};
