/**
 * Component Registry
 *
 * This is the single source of truth for:
 * - Component hierarchy (what's nested in what)
 * - Display names for the UI
 * - Which style fields (ThemeStyles) are editable per component
 * - Which config fields (ThemeConfig) are editable per component
 * - Which components can be toggled visible/hidden
 */

// Field type definitions
export type StyleFieldType =
  | "color"
  | "number"
  | "select"
  | "font-family"
  | "toggle";

export interface StyleField {
  type: StyleFieldType;
  /**
   * Path into ThemeStyles object, e.g. "journey-card.borderColor"
   * The first segment is the component key, the rest is the property path
   */
  path: string;
  label: string;
  unit?: "px" | "%" | "em" | "rem";
  options?: Array<{ value: string; label: string }>;
}

export type ConfigFieldType =
  | "text"
  | "url"
  | "image"
  | "number"
  | "toggle"
  | "select"
  | "menu-items";

export interface ConfigField {
  type: ConfigFieldType;
  /**
   * Path into ThemeConfig object, e.g. "branding.headerLogoUrl"
   */
  path: string;
  label: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface ComponentDefinition {
  /**
   * Unique identifier - matches the CSS class name in globals.css
   * e.g. "product-details", "journey-card__title"
   */
  id: string;

  /**
   * Human-readable name shown in the UI
   */
  displayName: string;

  /**
   * Nested child components
   */
  children?: ComponentDefinition[];

  /**
   * If true, shows an eye icon to toggle visibility
   * Only for top-level sections that have corresponding sections.show* flags
   */
  canToggleVisibility?: boolean;

  /**
   * The ThemeConfig path to toggle visibility, e.g. "sections.showCTABanner"
   */
  visibilityPath?: string;

  /**
   * Design token fields from ThemeStyles
   */
  styleFields?: StyleField[];

  /**
   * Content/config fields from ThemeConfig
   */
  configFields?: ConfigField[];
}

// =============================================================================
// COMPONENT HIERARCHY
// =============================================================================

export const COMPONENT_TREE: ComponentDefinition[] = [
  // -------------------------------------------------------------------------
  // HEADER
  // -------------------------------------------------------------------------
  {
    id: "header",
    displayName: "Header",
    configFields: [
      { type: "image", path: "branding.headerLogoUrl", label: "Logo Image" },
    ],
    styleFields: [
      { type: "color", path: "header.backgroundColor", label: "Background" },
      { type: "color", path: "header.borderColor", label: "Border Color" },
    ],
    children: [
      {
        id: "header__text-logo",
        displayName: "Text Logo",
        styleFields: [
          { type: "color", path: "header__text-logo.color", label: "Color" },
          {
            type: "font-family",
            path: "header__text-logo.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "header__text-logo.fontWeight",
            label: "Weight",
          },
          {
            type: "select",
            path: "header__text-logo.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
              { value: "lowercase", label: "Lowercase" },
              { value: "capitalize", label: "Capitalize" },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // PRODUCT IMAGE
  // -------------------------------------------------------------------------
  {
    id: "product__image",
    displayName: "Product Image",
    configFields: [
      {
        type: "number",
        path: "images.productImageZoom",
        label: "Zoom Level",
      },
      {
        type: "select",
        path: "images.productImagePosition",
        label: "Position",
        options: [
          { value: "top", label: "Top" },
          { value: "center", label: "Center" },
          { value: "bottom", label: "Bottom" },
        ],
      },
    ],
    styleFields: [
      {
        type: "color",
        path: "product__image.borderColor",
        label: "Border Color",
      },
      {
        type: "number",
        path: "product__image.borderRadius",
        label: "Border Radius",
        unit: "px",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // PRODUCT INFO
  // -------------------------------------------------------------------------
  {
    id: "product-info",
    displayName: "Product Info",
    children: [
      {
        id: "product__brand",
        displayName: "Brand Name",
        styleFields: [
          { type: "color", path: "product__brand.color", label: "Color" },
          {
            type: "font-family",
            path: "product__brand.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "product__brand.fontWeight",
            label: "Weight",
          },
          {
            type: "select",
            path: "product__brand.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
              { value: "lowercase", label: "Lowercase" },
            ],
          },
        ],
      },
      {
        id: "product__title",
        displayName: "Product Title",
        styleFields: [
          { type: "color", path: "product__title.color", label: "Color" },
          {
            type: "font-family",
            path: "product__title.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "product__title.fontSize",
            label: "Size",
            unit: "px",
          },
          {
            type: "number",
            path: "product__title.fontWeight",
            label: "Weight",
          },
          {
            type: "select",
            path: "product__title.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
              { value: "lowercase", label: "Lowercase" },
            ],
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
            type: "font-family",
            path: "product__description.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "product__description.fontWeight",
            label: "Weight",
          },
        ],
      },
      {
        id: "product__show-more",
        displayName: "Show More Link",
        styleFields: [
          {
            type: "color",
            path: "product__show-more.color",
            label: "Color",
          },
          {
            type: "select",
            path: "product__show-more.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // PRODUCT DETAILS
  // -------------------------------------------------------------------------
  {
    id: "product-details",
    displayName: "Product Details",
    styleFields: [
      {
        type: "color",
        path: "product-details.borderColor",
        label: "Border Color",
      },
      {
        type: "number",
        path: "product-details.borderRadius",
        label: "Border Radius",
        unit: "px",
      },
    ],
    children: [
      {
        id: "product-details__row",
        displayName: "Details Row",
        styleFields: [
          {
            type: "color",
            path: "product-details__row.borderColor",
            label: "Divider Color",
          },
        ],
        children: [
          {
            id: "product-details__row-label",
            displayName: "Row Label",
            styleFields: [
              {
                type: "color",
                path: "product-details__row-label.color",
                label: "Color",
              },
              {
                type: "font-family",
                path: "product-details__row-label.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "product-details__row-label.fontWeight",
                label: "Weight",
              },
              {
                type: "select",
                path: "product-details__row-label.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
          {
            id: "product-details__row-value",
            displayName: "Row Value",
            styleFields: [
              {
                type: "color",
                path: "product-details__row-value.color",
                label: "Color",
              },
              {
                type: "font-family",
                path: "product-details__row-value.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "product-details__row-value.fontWeight",
                label: "Weight",
              },
            ],
          },
          {
            id: "product-details__row-link",
            displayName: "Row Link",
            styleFields: [
              {
                type: "color",
                path: "product-details__row-link.color",
                label: "Color",
              },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // PRIMARY MENU
  // -------------------------------------------------------------------------
  {
    id: "menu-primary",
    displayName: "Primary Menu",
    canToggleVisibility: true,
    visibilityPath: "sections.showPrimaryMenu",
    configFields: [
      { type: "menu-items", path: "menus.primary", label: "Menu Items" },
    ],
    children: [
      {
        id: "menu-button",
        displayName: "Menu Button",
        styleFields: [
          { type: "color", path: "menu-button.color", label: "Text Color" },
          {
            type: "color",
            path: "menu-button.borderColor",
            label: "Border Color",
          },
          {
            type: "font-family",
            path: "menu-button.fontFamily",
            label: "Font",
          },
          { type: "number", path: "menu-button.fontWeight", label: "Weight" },
          {
            type: "select",
            path: "menu-button.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // IMPACT SECTION
  // -------------------------------------------------------------------------
  {
    id: "impact-section",
    displayName: "Impact",
    children: [
      {
        id: "impact-card",
        displayName: "Impact Card",
        styleFields: [
          {
            type: "color",
            path: "impact-card.backgroundColor",
            label: "Background",
          },
          {
            type: "color",
            path: "impact-card.borderColor",
            label: "Border Color",
          },
          {
            type: "number",
            path: "impact-card.borderRadius",
            label: "Border Radius",
            unit: "px",
          },
        ],
        children: [
          {
            id: "impact-card__title",
            displayName: "Section Title",
            styleFields: [
              {
                type: "color",
                path: "impact-card__title.color",
                label: "Color",
              },
              {
                type: "font-family",
                path: "impact-card__title.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "impact-card__title.fontWeight",
                label: "Weight",
              },
              {
                type: "select",
                path: "impact-card__title.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
          {
            id: "impact-card__type",
            displayName: "Metric Type",
            styleFields: [
              {
                type: "color",
                path: "impact-card__type.color",
                label: "Color",
              },
              {
                type: "select",
                path: "impact-card__type.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
          {
            id: "impact-card__value",
            displayName: "Metric Value",
            styleFields: [
              {
                type: "font-family",
                path: "impact-card__value.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "impact-card__value.fontWeight",
                label: "Weight",
              },
            ],
          },
          {
            id: "impact-card__unit",
            displayName: "Metric Unit",
            styleFields: [
              {
                type: "color",
                path: "impact-card__unit.color",
                label: "Color",
              },
            ],
          },
          {
            id: "impact-card__eco-claim",
            displayName: "Eco Claim Badge",
            styleFields: [
              {
                type: "color",
                path: "impact-card__eco-claim.backgroundColor",
                label: "Background",
              },
              {
                type: "color",
                path: "impact-card__eco-claim.borderColor",
                label: "Border Color",
              },
              {
                type: "number",
                path: "impact-card__eco-claim.borderRadius",
                label: "Border Radius",
                unit: "px",
              },
            ],
          },
          {
            id: "impact-card__eco-claim-text",
            displayName: "Eco Claim Text",
            styleFields: [
              {
                type: "color",
                path: "impact-card__eco-claim-text.color",
                label: "Color",
              },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MATERIALS SECTION
  // -------------------------------------------------------------------------
  {
    id: "materials-section",
    displayName: "Materials",
    configFields: [
      {
        type: "toggle",
        path: "materials.showCertificationCheckIcon",
        label: "Show Certification Check Icon",
      },
    ],
    children: [
      {
        id: "materials-card",
        displayName: "Materials Card",
        styleFields: [
          {
            type: "color",
            path: "materials-card.backgroundColor",
            label: "Background",
          },
          {
            type: "color",
            path: "materials-card.borderColor",
            label: "Border Color",
          },
          {
            type: "number",
            path: "materials-card.borderRadius",
            label: "Border Radius",
            unit: "px",
          },
        ],
        children: [
          {
            id: "materials-card__title",
            displayName: "Section Title",
            styleFields: [
              {
                type: "color",
                path: "materials-card__title.color",
                label: "Color",
              },
              {
                type: "font-family",
                path: "materials-card__title.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "materials-card__title.fontWeight",
                label: "Weight",
              },
              {
                type: "select",
                path: "materials-card__title.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
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
                type: "font-family",
                path: "materials-card__percentage.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "materials-card__percentage.fontWeight",
                label: "Weight",
              },
            ],
          },
          {
            id: "materials-card__type",
            displayName: "Material Type",
            styleFields: [
              {
                type: "color",
                path: "materials-card__type.color",
                label: "Color",
              },
              {
                type: "select",
                path: "materials-card__type.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
          {
            id: "materials-card__certification",
            displayName: "Certification Badge",
            styleFields: [
              {
                type: "color",
                path: "materials-card__certification.color",
                label: "Text Color",
              },
              {
                type: "color",
                path: "materials-card__certification.backgroundColor",
                label: "Background",
              },
              {
                type: "number",
                path: "materials-card__certification.borderRadius",
                label: "Border Radius",
                unit: "px",
              },
            ],
          },
          {
            id: "materials-card__origin",
            displayName: "Origin Text",
            styleFields: [
              {
                type: "color",
                path: "materials-card__origin.color",
                label: "Color",
              },
            ],
          },
          {
            id: "materials-card__certification-text",
            displayName: "Certification Link",
            styleFields: [
              {
                type: "color",
                path: "materials-card__certification-text.color",
                label: "Color",
              },
              {
                type: "select",
                path: "materials-card__certification-text.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // JOURNEY SECTION
  // -------------------------------------------------------------------------
  {
    id: "journey-section",
    displayName: "Journey",
    children: [
      {
        id: "journey-card",
        displayName: "Journey Card",
        styleFields: [
          {
            type: "color",
            path: "journey-card.backgroundColor",
            label: "Background",
          },
          {
            type: "color",
            path: "journey-card.borderColor",
            label: "Border Color",
          },
          {
            type: "number",
            path: "journey-card.borderRadius",
            label: "Border Radius",
            unit: "px",
          },
        ],
        children: [
          {
            id: "journey-card__title",
            displayName: "Section Title",
            styleFields: [
              {
                type: "color",
                path: "journey-card__title.color",
                label: "Color",
              },
              {
                type: "font-family",
                path: "journey-card__title.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "journey-card__title.fontWeight",
                label: "Weight",
              },
              {
                type: "select",
                path: "journey-card__title.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
          {
            id: "journey-card__line",
            displayName: "Timeline Line",
            styleFields: [
              {
                type: "color",
                path: "journey-card__line.backgroundColor",
                label: "Color",
              },
            ],
          },
          {
            id: "journey-card__type",
            displayName: "Stage Name",
            styleFields: [
              {
                type: "color",
                path: "journey-card__type.color",
                label: "Color",
              },
              {
                type: "font-family",
                path: "journey-card__type.fontFamily",
                label: "Font",
              },
              {
                type: "number",
                path: "journey-card__type.fontWeight",
                label: "Weight",
              },
              {
                type: "select",
                path: "journey-card__type.textTransform",
                label: "Transform",
                options: [
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                ],
              },
            ],
          },
          {
            id: "journey-card__operator",
            displayName: "Company Info",
            styleFields: [
              {
                type: "color",
                path: "journey-card__operator.color",
                label: "Color",
              },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // SECONDARY MENU
  // -------------------------------------------------------------------------
  {
    id: "menu-secondary",
    displayName: "Secondary Menu",
    canToggleVisibility: true,
    visibilityPath: "sections.showSecondaryMenu",
    configFields: [
      { type: "menu-items", path: "menus.secondary", label: "Menu Items" },
    ],
    // Uses same menu-button styling as primary menu
  },

  // -------------------------------------------------------------------------
  // PRODUCT CAROUSEL
  // -------------------------------------------------------------------------
  {
    id: "carousel",
    displayName: "Product Carousel",
    canToggleVisibility: true,
    visibilityPath: "sections.showSimilarProducts",
    configFields: [
      {
        type: "number",
        path: "images.carouselImageZoom",
        label: "Image Zoom",
      },
      {
        type: "select",
        path: "images.carouselImagePosition",
        label: "Image Position",
        options: [
          { value: "top", label: "Top" },
          { value: "center", label: "Center" },
          { value: "bottom", label: "Bottom" },
        ],
      },
    ],
    children: [
      {
        id: "carousel__title",
        displayName: "Section Title",
        styleFields: [
          { type: "color", path: "carousel__title.color", label: "Color" },
          {
            type: "font-family",
            path: "carousel__title.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "carousel__title.fontWeight",
            label: "Weight",
          },
          {
            type: "select",
            path: "carousel__title.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
            ],
          },
        ],
      },
      {
        id: "carousel__nav-button",
        displayName: "Navigation Buttons",
        styleFields: [
          {
            type: "color",
            path: "carousel__nav-button.color",
            label: "Icon Color",
          },
          {
            type: "color",
            path: "carousel__nav-button.borderColor",
            label: "Border Color",
          },
          {
            type: "color",
            path: "carousel__nav-button.backgroundColor",
            label: "Background",
          },
          {
            type: "number",
            path: "carousel__nav-button.borderRadius",
            label: "Border Radius",
            unit: "px",
          },
        ],
      },
      {
        id: "carousel__product-image",
        displayName: "Product Image",
        styleFields: [
          {
            type: "color",
            path: "carousel__product-image.borderColor",
            label: "Border Color",
          },
          {
            type: "number",
            path: "carousel__product-image.borderRadius",
            label: "Border Radius",
            unit: "px",
          },
        ],
      },
      {
        id: "carousel__product-name",
        displayName: "Product Name",
        styleFields: [
          {
            type: "color",
            path: "carousel__product-name.color",
            label: "Color",
          },
          {
            type: "font-family",
            path: "carousel__product-name.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "carousel__product-name.fontWeight",
            label: "Weight",
          },
          {
            type: "select",
            path: "carousel__product-name.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
            ],
          },
        ],
      },
      {
        id: "carousel__product-price",
        displayName: "Product Price",
        styleFields: [
          {
            type: "color",
            path: "carousel__product-price.color",
            label: "Color",
          },
          {
            type: "font-family",
            path: "carousel__product-price.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "carousel__product-price.fontWeight",
            label: "Weight",
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // CTA BANNER
  // -------------------------------------------------------------------------
  {
    id: "banner",
    displayName: "CTA Banner",
    canToggleVisibility: true,
    visibilityPath: "sections.showCTABanner",
    configFields: [
      {
        type: "image",
        path: "cta.bannerBackgroundImage",
        label: "Background Image",
      },
      { type: "image", path: "branding.bannerLogoUrl", label: "Logo Image" },
      {
        type: "number",
        path: "branding.bannerLogoHeight",
        label: "Logo Height",
      },
      { type: "text", path: "cta.bannerCTAText", label: "Button Text" },
      { type: "url", path: "cta.bannerCTAUrl", label: "Button URL" },
      {
        type: "toggle",
        path: "cta.bannerShowSubline",
        label: "Show Subline",
      },
      { type: "text", path: "cta.bannerSubline", label: "Subline Text" },
    ],
    styleFields: [
      {
        type: "color",
        path: "banner.backgroundColor",
        label: "Background Color",
      },
      {
        type: "number",
        path: "banner.borderRadius",
        label: "Border Radius",
        unit: "px",
      },
    ],
    children: [
      {
        id: "banner__subline",
        displayName: "Subline",
        styleFields: [
          { type: "color", path: "banner__subline.color", label: "Color" },
          {
            type: "font-family",
            path: "banner__subline.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "banner__subline.fontWeight",
            label: "Weight",
          },
        ],
      },
      {
        id: "banner__button",
        displayName: "CTA Button",
        styleFields: [
          { type: "color", path: "banner__button.color", label: "Text Color" },
          {
            type: "color",
            path: "banner__button.backgroundColor",
            label: "Background",
          },
          {
            type: "color",
            path: "banner__button.borderColor",
            label: "Border Color",
          },
          {
            type: "number",
            path: "banner__button.borderRadius",
            label: "Border Radius",
            unit: "px",
          },
          {
            type: "font-family",
            path: "banner__button.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "banner__button.fontWeight",
            label: "Weight",
          },
          {
            type: "select",
            path: "banner__button.textTransform",
            label: "Transform",
            options: [
              { value: "none", label: "None" },
              { value: "uppercase", label: "Uppercase" },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // FOOTER
  // -------------------------------------------------------------------------
  {
    id: "footer",
    displayName: "Footer",
    configFields: [
      { type: "text", path: "social.legalName", label: "Legal Name" },
      { type: "toggle", path: "social.useIcons", label: "Use Icons" },
      { type: "toggle", path: "social.showInstagram", label: "Show Instagram" },
      { type: "url", path: "social.instagramUrl", label: "Instagram URL" },
      { type: "toggle", path: "social.showFacebook", label: "Show Facebook" },
      { type: "url", path: "social.facebookUrl", label: "Facebook URL" },
      { type: "toggle", path: "social.showTwitter", label: "Show X/Twitter" },
      { type: "url", path: "social.twitterUrl", label: "X/Twitter URL" },
      {
        type: "toggle",
        path: "social.showPinterest",
        label: "Show Pinterest",
      },
      { type: "url", path: "social.pinterestUrl", label: "Pinterest URL" },
      { type: "toggle", path: "social.showTiktok", label: "Show TikTok" },
      { type: "url", path: "social.tiktokUrl", label: "TikTok URL" },
      { type: "toggle", path: "social.showLinkedin", label: "Show LinkedIn" },
      { type: "url", path: "social.linkedinUrl", label: "LinkedIn URL" },
    ],
    styleFields: [
      {
        type: "color",
        path: "footer.backgroundColor",
        label: "Background",
      },
      { type: "color", path: "footer.borderColor", label: "Border Color" },
    ],
    children: [
      {
        id: "footer__legal-name",
        displayName: "Legal Name",
        styleFields: [
          {
            type: "color",
            path: "footer__legal-name.color",
            label: "Color",
          },
          {
            type: "font-family",
            path: "footer__legal-name.fontFamily",
            label: "Font",
          },
          {
            type: "number",
            path: "footer__legal-name.fontWeight",
            label: "Weight",
          },
        ],
      },
      {
        id: "footer__social-icons",
        displayName: "Social Links",
        styleFields: [
          {
            type: "color",
            path: "footer__social-icons.color",
            label: "Color",
          },
        ],
      },
    ],
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Find a component definition by its ID
 */
export function findComponentById(
  id: string,
  tree: ComponentDefinition[] = COMPONENT_TREE
): ComponentDefinition | null {
  for (const component of tree) {
    if (component.id === id) {
      return component;
    }
    if (component.children) {
      const found = findComponentById(id, component.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get the ancestry chain for a component (for breadcrumb)
 */
export function getComponentAncestry(
  id: string,
  tree: ComponentDefinition[] = COMPONENT_TREE,
  path: ComponentDefinition[] = []
): ComponentDefinition[] | null {
  for (const component of tree) {
    if (component.id === id) {
      return [...path, component];
    }
    if (component.children) {
      const result = getComponentAncestry(id, component.children, [
        ...path,
        component,
      ]);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Get all component IDs as a flat list
 */
export function getAllComponentIds(
  tree: ComponentDefinition[] = COMPONENT_TREE
): string[] {
  const ids: string[] = [];
  for (const component of tree) {
    ids.push(component.id);
    if (component.children) {
      ids.push(...getAllComponentIds(component.children));
    }
  }
  return ids;
}

/**
 * Check if a CSS class name is a selectable component
 */
export function isSelectableComponent(className: string): boolean {
  return findComponentById(className) !== null;
}

