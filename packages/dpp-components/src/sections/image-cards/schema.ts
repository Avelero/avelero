/**
 * Image cards section schema.
 *
 * Defines the editor controls for the canvas-only three-card image row.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../registry";

const DEFAULT_IMAGE_CARD_BODY =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.";

interface ImageCardSlotConfig {
  id: "cardOne" | "cardTwo" | "cardThree";
  displayName: string;
  imagePath: string;
  imageAltPath: string;
  headingPath: string;
  bodyPath: string;
  urlPath: string;
  defaultHeading: string;
}

const IMAGE_CARD_SLOTS: ImageCardSlotConfig[] = [
  {
    id: "cardOne",
    displayName: "Card 1",
    imagePath: "cardOneImage",
    imageAltPath: "cardOneImageAlt",
    headingPath: "cardOneHeading",
    bodyPath: "cardOneBody",
    urlPath: "cardOneUrl",
    defaultHeading: "Heading",
  },
  {
    id: "cardTwo",
    displayName: "Card 2",
    imagePath: "cardTwoImage",
    imageAltPath: "cardTwoImageAlt",
    headingPath: "cardTwoHeading",
    bodyPath: "cardTwoBody",
    urlPath: "cardTwoUrl",
    defaultHeading: "Heading",
  },
  {
    id: "cardThree",
    displayName: "Card 3",
    imagePath: "cardThreeImage",
    imageAltPath: "cardThreeImageAlt",
    headingPath: "cardThreeHeading",
    bodyPath: "cardThreeBody",
    urlPath: "cardThreeUrl",
    defaultHeading: "Heading",
  },
] as const;

/**
 * Seed mock content defaults for all three image card slots.
 */
function createImageCardContentDefaults(): Record<string, string> {
  return IMAGE_CARD_SLOTS.reduce<Record<string, string>>((defaults, slot) => {
    defaults[slot.imagePath] = "";
    defaults[slot.imageAltPath] = "Placeholder image";
    defaults[slot.headingPath] = slot.defaultHeading;
    defaults[slot.bodyPath] = DEFAULT_IMAGE_CARD_BODY;
    defaults[slot.urlPath] = "";
    return defaults;
  }, {});
}

/**
 * Build per-card content fields with section grouping.
 */
function createImageCardContentFields() {
  return IMAGE_CARD_SLOTS.flatMap((slot) => [
    {
      type: "image" as const,
      path: slot.imagePath,
      label: "Image",
      section: slot.displayName,
    },
    {
      type: "text" as const,
      path: slot.imageAltPath,
      label: "Image Alt Text",
      section: slot.displayName,
    },
    {
      type: "text" as const,
      path: slot.headingPath,
      label: "Heading Text",
      section: slot.displayName,
    },
    {
      type: "textarea" as const,
      path: slot.bodyPath,
      label: "Body Text",
      section: slot.displayName,
    },
    {
      type: "url" as const,
      path: slot.urlPath,
      label: "URL",
      section: slot.displayName,
    },
  ]);
}

export const IMAGE_CARDS_SCHEMA: SectionSchema = {
  type: "imageCards",
  displayName: "Cards",
  allowedZones: ["canvas"],
  editorTree: {
    id: "imageCards",
    displayName: "Cards",
    styleFields: [
      { type: "color", path: "title.color", label: "Color", section: "Title" },
      {
        type: "typescale",
        path: "title.typescale",
        label: "Typography",
        section: "Title",
      },
      {
        type: "select",
        path: "title.textTransform",
        label: "Capitalization",
        section: "Title",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "cardHeading.color",
        label: "Color",
        section: "Card Heading",
      },
      {
        type: "typescale",
        path: "cardHeading.typescale",
        label: "Typography",
        section: "Card Heading",
      },
      {
        type: "select",
        path: "cardHeading.textTransform",
        label: "Capitalization",
        section: "Card Heading",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "cardBody.color",
        label: "Color",
        section: "Card Body",
      },
      {
        type: "typescale",
        path: "cardBody.typescale",
        label: "Typography",
        section: "Card Body",
      },
      {
        type: "select",
        path: "cardBody.textTransform",
        label: "Capitalization",
        section: "Card Body",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "cardButton.color",
        label: "Color",
        section: "Card Button",
      },
      {
        type: "typescale",
        path: "cardButton.typescale",
        label: "Typography",
        section: "Card Button",
      },
      {
        type: "select",
        path: "cardButton.textTransform",
        label: "Capitalization",
        section: "Card Button",
        options: [...CAPITALIZATION_STYLE_OPTIONS],
      },
      {
        type: "color",
        path: "cardImage.borderColor",
        label: "Border Color",
        section: "Card Image Border",
      },
      {
        type: "border",
        path: "cardImage.borderWidth",
        label: "Border Width",
        section: "Card Image Border",
      },
      {
        type: "radius",
        path: "cardImage.borderRadius",
        label: "Corner Radius",
        section: "Card Image Border",
      },
    ],
    configFields: [
      { type: "text", path: "title", label: "Title Text" },
      ...createImageCardContentFields(),
    ],
  },
  defaults: {
    styles: {
      container: {},
      title: {
        typescale: "h3",
        color: "$foreground",
        textTransform: "none",
      },
      cardImage: {
        aspectRatio: 1,
        borderColor: "$border",
        borderRadius: 4,
        borderWidth: 0,
      },
      cardHeading: {
        typescale: "h6",
        color: "$foreground",
        textTransform: "none",
      },
      cardBody: {
        typescale: "body",
        color: "$link",
        textTransform: "none",
      },
      cardButton: {
        typescale: "body",
        color: "$link",
        textTransform: "none",
      },
    },
    content: {
      title: "Heading",
      ...createImageCardContentDefaults(),
    },
  },
};
