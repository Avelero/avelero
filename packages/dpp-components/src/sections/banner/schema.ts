import type { SectionSchema } from "../registry";

export const BANNER_SCHEMA: SectionSchema = {
  type: "banner",
  displayName: "CTA Banner",
  allowedZones: ["canvas"],
  defaultContent: {
    headline: "",
    subline: "",
    ctaText: "",
    ctaUrl: "",
    backgroundImage: "",
  },
  defaultStyles: {
    container: { backgroundColor: "$primary", borderRadius: 0 },
    headline: {
      typescale: "h2",
      color: "$primaryForeground",
      textAlign: "center",
    },
    subline: {
      typescale: "body",
      color: "$primaryForeground",
      textAlign: "center",
    },
    button: {
      typescale: "body-sm",
      color: "$primaryForeground",
      borderColor: "$primaryForeground",
      borderRadius: 0,
      borderWidth: 1,
    },
  },
  editorTree: {
    id: "banner",
    displayName: "CTA Banner",
    children: [
      {
        id: "banner.container",
        displayName: "Container",
        styleFields: [
          {
            type: "color",
            path: "container.backgroundColor",
            label: "Background Color",
          },
          {
            type: "radius",
            path: "container.borderRadius",
            label: "Border Radius",
          },
        ],
        configFields: [
          { type: "image", path: "backgroundImage", label: "Background Image" },
        ],
      },
      {
        id: "banner.headline",
        displayName: "Headline",
        styleFields: [
          { type: "color", path: "headline.color", label: "Color" },
          {
            type: "typescale",
            path: "headline.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "headline.textAlign",
            label: "Alignment",
            options: [
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ],
          },
        ],
        configFields: [
          { type: "text", path: "headline", label: "Headline Text" },
        ],
      },
      {
        id: "banner.subline",
        displayName: "Subline",
        styleFields: [
          { type: "color", path: "subline.color", label: "Color" },
          { type: "typescale", path: "subline.typescale", label: "Typography" },
          {
            type: "select",
            path: "subline.textAlign",
            label: "Alignment",
            options: [
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ],
          },
        ],
        configFields: [
          { type: "text", path: "subline", label: "Subline Text" },
        ],
      },
      {
        id: "banner.button",
        displayName: "Button",
        styleFields: [
          { type: "color", path: "button.color", label: "Text Color" },
          { type: "color", path: "button.borderColor", label: "Border Color" },
          { type: "typescale", path: "button.typescale", label: "Typography" },
          {
            type: "radius",
            path: "button.borderRadius",
            label: "Border Radius",
          },
          { type: "border", path: "button.borderWidth", label: "Border Width" },
        ],
        configFields: [
          { type: "text", path: "ctaText", label: "Button Text" },
          { type: "url", path: "ctaUrl", label: "Button URL" },
        ],
      },
    ],
  },
};
