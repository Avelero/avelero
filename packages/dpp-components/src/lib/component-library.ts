/**
 * Component Library Registry
 *
 * Replaces COMPONENT_TREE as the source of truth for what components exist,
 * where they can go in the layout, and what fields are editable.
 *
 * Header and Footer are NOT in this registry - they are fixed structural
 * elements that are always rendered and edited separately.
 */

import type { ComponentType, ZoneId } from "../types/layout-config";
import type { ComponentDefinition } from "./component-library-types";

// =============================================================================
// SHARED OPTIONS
// =============================================================================

const CAPITALIZATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "capitalize", label: "Capitalize" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
];

const ALIGN_ITEMS_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" },
];

const JUSTIFY_CONTENT_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Space Between" },
  { value: "space-around", label: "Space Around" },
];

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

// =============================================================================
// COMPONENT LIBRARY
// =============================================================================

export interface ComponentLibraryEntry {
  type: ComponentType;
  displayName: string;
  allowedZones: ZoneId[];
  /** Default content when creating a new instance */
  defaultContent: Record<string, unknown>;
  /** The component tree definition for the style/content editor */
  editorTree: ComponentDefinition;
}

export const COMPONENT_LIBRARY: Record<ComponentType, ComponentLibraryEntry> = {
  // ---------------------------------------------------------------------------
  // PRODUCT IMAGE
  // ---------------------------------------------------------------------------
  image: {
    type: "image",
    displayName: "Product Image",
    allowedZones: ["column-left", "column-right"],
    defaultContent: {},
    editorTree: {
      id: "product__image",
      displayName: "Product Image",
      styleFields: [
        {
          type: "color",
          path: "product__image.borderColor",
          label: "Border Color",
        },
        {
          type: "radius",
          path: "product__image.borderRadius",
          label: "Rounding",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // HERO (Product Information: brand, title, description)
  // ---------------------------------------------------------------------------
  hero: {
    type: "hero",
    displayName: "Hero",
    allowedZones: ["column-left", "column-right"],
    defaultContent: {},
    editorTree: {
      id: "product-info",
      displayName: "Hero",
      isGrouping: true,
      children: [
        {
          id: "product__brand",
          displayName: "Brand Name",
          styleFields: [
            {
              type: "color",
              path: "product__brand.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "product__brand.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "product__brand.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
        {
          id: "product__title",
          displayName: "Product Title",
          styleFields: [
            {
              type: "color",
              path: "product__title.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "product__title.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "product__title.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
        {
          id: "product__description",
          displayName: "Product Description",
          styleFields: [
            {
              type: "color",
              path: "product__description.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "product__description.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "product__description.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
        {
          id: "product__show-more",
          displayName: "Show More",
          styleFields: [
            {
              type: "color",
              path: "product__show-more.color",
              label: "Color",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // PRODUCT DETAILS
  // ---------------------------------------------------------------------------
  details: {
    type: "details",
    displayName: "Details",
    allowedZones: ["column-left", "column-right"],
    defaultContent: {},
    editorTree: {
      id: "product-details",
      displayName: "Details",
      styleFields: [
        {
          type: "color",
          path: "product-details.borderColor",
          label: "Border Color",
        },
        {
          type: "color",
          path: "product-details.backgroundColor",
          label: "Background",
        },
        {
          type: "radius",
          path: "product-details.borderRadius",
          label: "Rounding",
        },
      ],
      children: [
        {
          id: "product-details__label",
          displayName: "Label",
          styleFields: [
            {
              type: "color",
              path: "product-details__label.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "product-details__label.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "product-details__label.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
        {
          id: "product-details__value",
          displayName: "Value",
          styleFields: [
            {
              type: "color",
              path: "product-details__value.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "product-details__value.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "product-details__value.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // BUTTONS (Menu)
  // ---------------------------------------------------------------------------
  buttons: {
    type: "buttons",
    displayName: "Buttons",
    allowedZones: ["column-left", "column-right"],
    defaultContent: {
      items: [
        { label: "Button One", url: "https://avelero.com/" },
        { label: "Button Two", url: "https://avelero.com/" },
      ],
      variant: "primary",
    },
    editorTree: {
      id: "menu-buttons",
      displayName: "Buttons",
      styleFields: [
        {
          type: "color",
          path: "menu-primary-button.borderColor",
          label: "Border Color",
        },
        {
          type: "color",
          path: "menu-primary-button.backgroundColor",
          label: "Background",
        },
        {
          type: "color",
          path: "menu-primary-button.color",
          label: "Color",
          section: "Text",
        },
        {
          type: "typescale",
          path: "menu-primary-button.typescale",
          label: "Typescale",
          section: "Text",
        },
        {
          type: "select",
          path: "menu-primary-button.textTransform",
          label: "Capitalization",
          section: "Text",
          options: CAPITALIZATION_OPTIONS,
        },
        {
          type: "color",
          path: "menu-primary-button__icon.color",
          label: "Color",
          section: "Icon",
        },
        {
          type: "number",
          path: "menu-primary-button__icon.size",
          label: "Size",
          section: "Icon",
          unit: "px",
        },
      ],
      configFields: [
        {
          type: "modal",
          path: "menus.primary",
          label: "Configure Buttons",
          modalType: "menu-primary",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // IMPACT
  // ---------------------------------------------------------------------------
  impact: {
    type: "impact",
    displayName: "Impact",
    allowedZones: ["column-left", "column-right"],
    defaultContent: {},
    editorTree: {
      id: "impact-section",
      displayName: "Impact",
      isGrouping: true,
      children: [
        {
          id: "impact-card__title",
          displayName: "Title",
          styleFields: [
            {
              type: "color",
              path: "impact-card__title.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "impact-card__title.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "impact-card__title.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
        {
          id: "impact-card",
          displayName: "Impact Card",
          styleFields: [
            {
              type: "color",
              path: "impact-card.borderColor",
              label: "Border Color",
            },
            {
              type: "color",
              path: "impact-card.backgroundColor",
              label: "Background",
            },
            {
              type: "radius",
              path: "impact-card.borderRadius",
              label: "Rounding",
            },
          ],
          children: [
            {
              id: "impact-card__icon",
              displayName: "Icon",
              styleFields: [
                {
                  type: "color",
                  path: "impact-card__icon.color",
                  label: "Color",
                },
                {
                  type: "number",
                  path: "impact-card__icon.size",
                  label: "Size",
                  unit: "px",
                },
              ],
            },
            {
              id: "impact-card__type",
              displayName: "Type",
              styleFields: [
                {
                  type: "color",
                  path: "impact-card__type.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "impact-card__type.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "impact-card__type.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "impact-card__value",
              displayName: "Value",
              styleFields: [
                {
                  type: "color",
                  path: "impact-card__value.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "impact-card__value.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "impact-card__value.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "impact-card__unit",
              displayName: "Unit",
              styleFields: [
                {
                  type: "color",
                  path: "impact-card__unit.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "impact-card__unit.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "impact-card__unit.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
          ],
        },
        {
          id: "impact-card__eco-claim",
          displayName: "Eco Claim",
          styleFields: [
            {
              type: "color",
              path: "impact-card__eco-claim.borderColor",
              label: "Border Color",
            },
            {
              type: "color",
              path: "impact-card__eco-claim.backgroundColor",
              label: "Background",
            },
            {
              type: "radius",
              path: "impact-card__eco-claim.borderRadius",
              label: "Rounding",
            },
          ],
          children: [
            {
              id: "impact-card__eco-claim-icon",
              displayName: "Icon",
              styleFields: [
                {
                  type: "color",
                  path: "impact-card__eco-claim-icon.color",
                  label: "Color",
                },
                {
                  type: "number",
                  path: "impact-card__eco-claim-icon.size",
                  label: "Size",
                  unit: "px",
                },
              ],
            },
            {
              id: "impact-card__eco-claim-text",
              displayName: "Claim",
              styleFields: [
                {
                  type: "color",
                  path: "impact-card__eco-claim-text.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "impact-card__eco-claim-text.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "impact-card__eco-claim-text.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // MATERIALS
  // ---------------------------------------------------------------------------
  materials: {
    type: "materials",
    displayName: "Materials",
    allowedZones: ["column-left", "column-right"],
    defaultContent: {},
    editorTree: {
      id: "materials-section",
      displayName: "Materials",
      isGrouping: true,
      children: [
        {
          id: "materials-card__title",
          displayName: "Title",
          styleFields: [
            {
              type: "color",
              path: "materials-card__title.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "materials-card__title.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "materials-card__title.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
        {
          id: "materials-card",
          displayName: "Materials Card",
          styleFields: [
            {
              type: "color",
              path: "materials-card.borderColor",
              label: "Border Color",
            },
            {
              type: "color",
              path: "materials-card.backgroundColor",
              label: "Background",
            },
            {
              type: "radius",
              path: "materials-card.borderRadius",
              label: "Rounding",
            },
          ],
          children: [
            {
              id: "materials-card__percentage",
              displayName: "Percentage",
              styleFields: [
                {
                  type: "color",
                  path: "materials-card__percentage.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "materials-card__percentage.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "materials-card__percentage.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "materials-card__type",
              displayName: "Material",
              styleFields: [
                {
                  type: "color",
                  path: "materials-card__type.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "materials-card__type.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "materials-card__type.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "materials-card__origin",
              displayName: "Origin",
              styleFields: [
                {
                  type: "color",
                  path: "materials-card__origin.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "materials-card__origin.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "materials-card__origin.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "materials-card__certification-text",
              displayName: "Certification",
              styleFields: [
                {
                  type: "color",
                  path: "materials-card__certification-text.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "materials-card__certification-text.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "materials-card__certification-text.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "materials-card__certification",
              displayName: "Tag",
              styleFields: [
                {
                  type: "color",
                  path: "materials-card__certification.borderColor",
                  label: "Border Color",
                },
                {
                  type: "color",
                  path: "materials-card__certification.backgroundColor",
                  label: "Background",
                },
                {
                  type: "radius",
                  path: "materials-card__certification.borderRadius",
                  label: "Rounding",
                },
                {
                  type: "color",
                  path: "materials-card__certification-icon.color",
                  label: "Color",
                  section: "Icon",
                },
                {
                  type: "number",
                  path: "materials-card__certification-icon.size",
                  label: "Size",
                  section: "Icon",
                  unit: "px",
                },
                {
                  type: "color",
                  path: "materials-card__certification.color",
                  label: "Color",
                  section: "Text",
                },
                {
                  type: "typescale",
                  path: "materials-card__certification.typescale",
                  label: "Typescale",
                  section: "Text",
                },
                {
                  type: "select",
                  path: "materials-card__certification.textTransform",
                  label: "Capitalization",
                  section: "Text",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // JOURNEY
  // ---------------------------------------------------------------------------
  journey: {
    type: "journey",
    displayName: "Journey",
    allowedZones: ["column-left", "column-right"],
    defaultContent: {},
    editorTree: {
      id: "journey-section",
      displayName: "Journey",
      isGrouping: true,
      children: [
        {
          id: "journey-card__title",
          displayName: "Title",
          styleFields: [
            {
              type: "color",
              path: "journey-card__title.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "journey-card__title.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "journey-card__title.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
        {
          id: "journey-card",
          displayName: "Journey Card",
          styleFields: [
            {
              type: "color",
              path: "journey-card.borderColor",
              label: "Border Color",
            },
            {
              type: "color",
              path: "journey-card.backgroundColor",
              label: "Background",
            },
            {
              type: "radius",
              path: "journey-card.borderRadius",
              label: "Rounding",
            },
          ],
          children: [
            {
              id: "journey-card__type",
              displayName: "Step",
              styleFields: [
                {
                  type: "color",
                  path: "journey-card__type.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "journey-card__type.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "journey-card__type.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "journey-card__operator",
              displayName: "Operator",
              styleFields: [
                {
                  type: "color",
                  path: "journey-card__operator.color",
                  label: "Color",
                },
                {
                  type: "typescale",
                  path: "journey-card__operator.typescale",
                  label: "Typescale",
                },
                {
                  type: "select",
                  path: "journey-card__operator.textTransform",
                  label: "Capitalization",
                  options: CAPITALIZATION_OPTIONS,
                },
              ],
            },
            {
              id: "journey-card__line",
              displayName: "Line",
              styleFields: [
                {
                  type: "color",
                  path: "journey-card__line.backgroundColor",
                  label: "Color",
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // BANNER (CTA)
  // ---------------------------------------------------------------------------
  banner: {
    type: "banner",
    displayName: "Banner",
    allowedZones: ["content"],
    defaultContent: {
      backgroundImage: "",
      headline: "Avelero Apparel",
      subline: "",
      ctaText: "Discover More",
      ctaUrl: "https://avelero.com/",
      showHeadline: true,
      showSubline: false,
      showButton: true,
    },
    editorTree: {
      id: "banner",
      displayName: "Banner",
      styleFields: [
        {
          type: "color",
          path: "banner.borderColor",
          label: "Border Color",
        },
        {
          type: "border",
          path: "banner.borderWidth",
          label: "Border Width",
        },
        {
          type: "radius",
          path: "banner.borderRadius",
          label: "Rounding",
        },
        {
          type: "select",
          path: "banner__container.alignItems",
          label: "Align Items",
          options: ALIGN_ITEMS_OPTIONS,
          section: "Layout",
        },
        {
          type: "select",
          path: "banner__container.justifyContent",
          label: "Justify Content",
          options: JUSTIFY_CONTENT_OPTIONS,
          section: "Layout",
        },
      ],
      configFields: [
        {
          type: "toggle",
          path: "cta.showHeadline",
          label: "Show Headline",
          section: "Visibility",
        },
        {
          type: "toggle",
          path: "cta.showSubline",
          label: "Show Subheadline",
          section: "Visibility",
        },
        {
          type: "toggle",
          path: "cta.showButton",
          label: "Show Button",
          section: "Visibility",
        },
        {
          type: "text",
          path: "cta.bannerHeadline",
          label: "Text",
          placeholder: "Enter headline...",
          section: "Headline",
        },
        {
          type: "text",
          path: "cta.bannerSubline",
          label: "Text",
          placeholder: "Enter subheadline...",
          section: "Subheadline",
        },
        {
          type: "text",
          path: "cta.bannerCTAText",
          label: "Label",
          placeholder: "Button text...",
          section: "Button",
        },
        {
          type: "url",
          path: "cta.bannerCTAUrl",
          label: "URL",
          placeholder: "https://...",
          section: "Button",
        },
        {
          type: "image",
          path: "cta.bannerBackgroundImage",
          label: "Image",
          section: "Background",
        },
      ],
      children: [
        {
          id: "banner__headline",
          displayName: "Headline",
          styleFields: [
            {
              type: "color",
              path: "banner__headline.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "banner__headline.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "banner__headline.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
            {
              type: "select",
              path: "banner__headline.textAlign",
              label: "Alignment",
              options: TEXT_ALIGN_OPTIONS,
            },
          ],
        },
        {
          id: "banner__subline",
          displayName: "Subheadline",
          styleFields: [
            {
              type: "color",
              path: "banner__subline.color",
              label: "Color",
            },
            {
              type: "typescale",
              path: "banner__subline.typescale",
              label: "Typescale",
            },
            {
              type: "select",
              path: "banner__subline.textTransform",
              label: "Capitalization",
              options: CAPITALIZATION_OPTIONS,
            },
            {
              type: "select",
              path: "banner__subline.textAlign",
              label: "Alignment",
              options: TEXT_ALIGN_OPTIONS,
            },
          ],
        },
        {
          id: "banner__button",
          displayName: "Button",
          styleFields: [
            {
              type: "color",
              path: "banner__button.borderColor",
              label: "Border Color",
            },
            {
              type: "border",
              path: "banner__button.borderWidth",
              label: "Border Width",
            },
            {
              type: "color",
              path: "banner__button.backgroundColor",
              label: "Background",
            },
            {
              type: "radius",
              path: "banner__button.borderRadius",
              label: "Rounding",
            },
            {
              type: "color",
              path: "banner__button.color",
              label: "Color",
              section: "Label",
            },
            {
              type: "typescale",
              path: "banner__button.typescale",
              label: "Typescale",
              section: "Label",
            },
            {
              type: "select",
              path: "banner__button.textTransform",
              label: "Capitalization",
              section: "Label",
              options: CAPITALIZATION_OPTIONS,
            },
          ],
        },
      ],
    },
  },
};
