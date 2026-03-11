/**
 * Image cards section schema.
 *
 * Defines the editor controls for the canvas-only three-card image row.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { ComponentDefinition, SectionSchema } from "../registry";

interface ImageCardSlotConfig {
  id: "cardOne" | "cardTwo" | "cardThree";
  displayName: string;
  imagePath: string;
  imageAltPath: string;
  headingPath: string;
  bodyPath: string;
  urlPath: string;
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
  },
  {
    id: "cardTwo",
    displayName: "Card 2",
    imagePath: "cardTwoImage",
    imageAltPath: "cardTwoImageAlt",
    headingPath: "cardTwoHeading",
    bodyPath: "cardTwoBody",
    urlPath: "cardTwoUrl",
  },
  {
    id: "cardThree",
    displayName: "Card 3",
    imagePath: "cardThreeImage",
    imageAltPath: "cardThreeImageAlt",
    headingPath: "cardThreeHeading",
    bodyPath: "cardThreeBody",
    urlPath: "cardThreeUrl",
  },
] as const;

/**
 * Build the repeated editor subtree for a single image card slot.
 */
function createImageCardNode(slot: ImageCardSlotConfig): ComponentDefinition {
  return {
    id: `imageCards.${slot.id}`,
    displayName: slot.displayName,
    isGrouping: true,
    children: [
      {
        id: `imageCards.${slot.id}.image`,
        displayName: "Image",
        configFields: [
          { type: "image", path: slot.imagePath, label: "Image" },
          { type: "text", path: slot.imageAltPath, label: "Image Alt Text" },
        ],
      },
      {
        id: `imageCards.${slot.id}.heading`,
        displayName: "Heading",
        styleFields: [
          { type: "color", path: "cardHeading.color", label: "Color" },
          {
            type: "typescale",
            path: "cardHeading.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "cardHeading.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [
          { type: "text", path: slot.headingPath, label: "Heading Text" },
        ],
      },
      {
        id: `imageCards.${slot.id}.body`,
        displayName: "Body",
        styleFields: [
          { type: "color", path: "cardBody.color", label: "Color" },
          {
            type: "typescale",
            path: "cardBody.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "cardBody.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [
          { type: "textarea", path: slot.bodyPath, label: "Body Text" },
        ],
      },
      {
        id: `imageCards.${slot.id}.button`,
        displayName: "Button",
        styleFields: [
          { type: "color", path: "cardButton.color", label: "Color" },
          {
            type: "typescale",
            path: "cardButton.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "cardButton.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [{ type: "url", path: slot.urlPath, label: "URL" }],
      },
    ],
  };
}

/**
 * Seed blank content defaults for all three image card slots.
 */
function createImageCardContentDefaults(): Record<string, string> {
  return IMAGE_CARD_SLOTS.reduce<Record<string, string>>((defaults, slot) => {
    defaults[slot.imagePath] = "";
    defaults[slot.imageAltPath] = "";
    defaults[slot.headingPath] = "";
    defaults[slot.bodyPath] = "";
    defaults[slot.urlPath] = "";
    return defaults;
  }, {});
}

export const IMAGE_CARDS_SCHEMA: SectionSchema = {
  type: "imageCards",
  displayName: "Image Cards",
  allowedZones: ["canvas"],
  editorTree: {
    id: "imageCards",
    displayName: "Image Cards",
    children: [
      {
        id: "imageCards.container",
        displayName: "Container",
      },
      {
        id: "imageCards.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "title.color", label: "Color" },
          { type: "typescale", path: "title.typescale", label: "Typography" },
          {
            type: "select",
            path: "title.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [{ type: "text", path: "title", label: "Title Text" }],
      },
      ...IMAGE_CARD_SLOTS.map(createImageCardNode),
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
        borderRadius: 4,
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
      title: "",
      ...createImageCardContentDefaults(),
    },
  },
};
