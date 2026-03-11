/**
 * Text and image section schema.
 *
 * Defines the editor controls for the full-width canvas feature block.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

export const TEXT_IMAGE_SCHEMA: SectionSchema = {
  type: "textImage",
  displayName: "Text + Image",
  allowedZones: ["canvas"],
  editorTree: {
    id: "textImage",
    displayName: "Text + Image",
    children: [
      {
        id: "textImage.container",
        displayName: "Container",
      },
      {
        id: "textImage.heading",
        displayName: "Heading",
        styleFields: [
          { type: "color", path: "heading.color", label: "Color" },
          {
            type: "typescale",
            path: "heading.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "heading.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [
          { type: "textarea", path: "headline", label: "Heading Text" },
        ],
      },
      {
        id: "textImage.body",
        displayName: "Body",
        styleFields: [
          { type: "color", path: "body.color", label: "Color" },
          { type: "typescale", path: "body.typescale", label: "Typography" },
          {
            type: "select",
            path: "body.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [{ type: "textarea", path: "body", label: "Body Text" }],
      },
      {
        id: "textImage.image",
        displayName: "Image",
        configFields: [
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
        borderRadius: 4,
      },
    },
    content: {
      headline: "",
      body: "",
      image: "",
      imageAlt: "",
      imagePosition: "right",
      mobileLayout: "split",
    },
  },
};
