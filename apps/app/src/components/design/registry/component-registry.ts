/**
 * Component Registry
 *
 * This is the single source of truth for:
 * - Component hierarchy (what's nested in what)
 * - Display names for the UI
 * - Which style fields (ThemeStyles) are editable per component
 * - Which config fields (ThemeConfig) are editable per component
 * - Which components can be toggled visible/hidden
 *
 * ## Design Principles
 *
 * 1. **Text elements use Typescale selection** instead of individual font properties.
 *    Users pick from H1-H6, Body, Body-sm, Body-xs to keep designs cohesive.
 *
 * 2. **Containers own their border colors** - child elements inherit border styling
 *    from their parent container (e.g., product-details rows inherit from the container).
 *
 * 3. **Link colors are global** - set via the Colors section, not per-component.
 *
 * 4. **Nested design sections become field groups** - Instead of separate tree items,
 *    sub-elements like "Text" or "Icon" become sections in the parent's editor using
 *    the `section` property on StyleField.
 *
 * 5. **Pure groupings just expand** - Items without styleFields/configFields only
 *    expand/collapse on click, they don't navigate to an editor.
 */

// =============================================================================
// FIELD TYPE DEFINITIONS
// =============================================================================

export type StyleFieldType =
  | "color"
  | "number"
  | "radius" // 4-corner border-radius input
  | "select"
  | "typescale" // Dropdown to select from H1-H6, Body, Body-sm, Body-xs
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
  /**
   * Optional section name to group fields under a header in the editor.
   * Fields without a section appear at the top ungrouped.
   * Example sections: "Text", "Icon", "Background", "Border"
   */
  section?: string;
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

  /**
   * If true, this component only serves to group children in the tree.
   * It will expand/collapse on click instead of navigating to an editor.
   * - No chevronRight icon shown
   * - No cursor-pointer on hover
   * - Click just toggles expand/collapse
   */
  isGrouping?: boolean;
}

// =============================================================================
// TYPESCALE OPTIONS (used by typescale select fields)
// =============================================================================

export const TYPESCALE_OPTIONS = [
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
  { value: "body", label: "Body" },
  { value: "body-sm", label: "Body Small" },
  { value: "body-xs", label: "Body XS" },
];

export const CAPITALIZATION_OPTIONS = [
  { value: "none", label: "Normal" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
];

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
      { type: "image", path: "branding.headerLogoUrl", label: "Logo" },
    ],
    styleFields: [
      { type: "color", path: "header.borderColor", label: "Border Color" },
      { type: "color", path: "header.backgroundColor", label: "Background" },
    ],
  },

  // -------------------------------------------------------------------------
  // PRODUCT IMAGE
  // -------------------------------------------------------------------------
  {
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

  // -------------------------------------------------------------------------
  // PRODUCT INFORMATION (grouping only)
  // -------------------------------------------------------------------------
  {
    id: "product-info",
    displayName: "Product Information",
    isGrouping: true,
    children: [
      {
        id: "product__brand",
        displayName: "Brand Name",
        styleFields: [
          { type: "color", path: "product__brand.color", label: "Color" },
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
          { type: "color", path: "product__title.color", label: "Color" },
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
          { type: "color", path: "product__description.color", label: "Color" },
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
          { type: "color", path: "product__show-more.color", label: "Color" },
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

  // -------------------------------------------------------------------------
  // PRIMARY MENU
  // Uses separate CSS class from secondary menu for individual styling
  // -------------------------------------------------------------------------
  {
    id: "menu-primary",
    displayName: "First Menu",
    canToggleVisibility: true,
    visibilityPath: "sections.showPrimaryMenu",
    configFields: [
      { type: "menu-items", path: "menus.primary", label: "Menu Items" },
    ],
    children: [
      {
        id: "menu-primary-button",
        displayName: "Menu Button",
        styleFields: [
          // Border & Background
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
          // Text section
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
          // Icon section
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
      },
    ],
  },

  // -------------------------------------------------------------------------
  // IMPACT SECTION
  // -------------------------------------------------------------------------
  {
    id: "impact-section",
    displayName: "Impact",
    isGrouping: true,
    children: [
      {
        id: "impact-card__title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "impact-card__title.color", label: "Color" },
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
          // Border & Background
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
          // Icon section
          {
            type: "color",
            path: "impact-card__icon.color",
            label: "Color",
            section: "Icon",
          },
          {
            type: "number",
            path: "impact-card__icon.size",
            label: "Size",
            section: "Icon",
            unit: "px",
          },
        ],
        children: [
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
              { type: "color", path: "impact-card__unit.color", label: "Color" },
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
          // Border & Background
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
          // Icon section
          {
            type: "color",
            path: "impact-card__eco-claim-icon.color",
            label: "Color",
            section: "Icon",
          },
          {
            type: "number",
            path: "impact-card__eco-claim-icon.size",
            label: "Size",
            section: "Icon",
            unit: "px",
          },
        ],
        children: [
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

  // -------------------------------------------------------------------------
  // MATERIALS SECTION
  // -------------------------------------------------------------------------
  {
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
              // Border & Background
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
              // Icon section
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
              // Text section
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

  // -------------------------------------------------------------------------
  // JOURNEY SECTION
  // -------------------------------------------------------------------------
  {
    id: "journey-section",
    displayName: "Journey",
    isGrouping: true,
    children: [
      {
        id: "journey-card__title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "journey-card__title.color", label: "Color" },
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

  // -------------------------------------------------------------------------
  // SECONDARY MENU
  // Uses separate CSS class from primary menu for individual styling
  // -------------------------------------------------------------------------
  {
    id: "menu-secondary",
    displayName: "Second Menu",
    canToggleVisibility: true,
    visibilityPath: "sections.showSecondaryMenu",
    configFields: [
      { type: "menu-items", path: "menus.secondary", label: "Menu Items" },
    ],
    children: [
      {
        id: "menu-secondary-button",
        displayName: "Menu Button",
        styleFields: [
          // Border & Background
          {
            type: "color",
            path: "menu-secondary-button.borderColor",
            label: "Border Color",
          },
          {
            type: "color",
            path: "menu-secondary-button.backgroundColor",
            label: "Background",
          },
          // Text section
          {
            type: "color",
            path: "menu-secondary-button.color",
            label: "Color",
            section: "Text",
          },
          {
            type: "typescale",
            path: "menu-secondary-button.typescale",
            label: "Typescale",
            section: "Text",
          },
          {
            type: "select",
            path: "menu-secondary-button.textTransform",
            label: "Capitalization",
            section: "Text",
            options: CAPITALIZATION_OPTIONS,
          },
          // Icon section
          {
            type: "color",
            path: "menu-secondary-button__icon.color",
            label: "Color",
            section: "Icon",
          },
          {
            type: "number",
            path: "menu-secondary-button__icon.size",
            label: "Size",
            section: "Icon",
            unit: "px",
          },
        ],
      },
    ],
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
        displayName: "Title",
        styleFields: [
          { type: "color", path: "carousel__title.color", label: "Color" },
          {
            type: "typescale",
            path: "carousel__title.typescale",
            label: "Typescale",
          },
          {
            type: "select",
            path: "carousel__title.textTransform",
            label: "Capitalization",
            options: CAPITALIZATION_OPTIONS,
          },
        ],
      },
      {
        id: "carousel__product-card",
        displayName: "Product Card",
        isGrouping: true,
        children: [
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
                type: "radius",
                path: "carousel__product-image.borderRadius",
                label: "Rounding",
              },
            ],
          },
          {
            id: "carousel__product-details",
            displayName: "Product Details",
            isGrouping: true,
            children: [
              {
                id: "carousel__product-name",
                displayName: "Title",
                styleFields: [
                  {
                    type: "color",
                    path: "carousel__product-name.color",
                    label: "Color",
                  },
                  {
                    type: "typescale",
                    path: "carousel__product-name.typescale",
                    label: "Typescale",
                  },
                  {
                    type: "select",
                    path: "carousel__product-name.textTransform",
                    label: "Capitalization",
                    options: CAPITALIZATION_OPTIONS,
                  },
                ],
              },
              {
                id: "carousel__product-price",
                displayName: "Price",
                styleFields: [
                  {
                    type: "color",
                    path: "carousel__product-price.color",
                    label: "Color",
                  },
                  {
                    type: "typescale",
                    path: "carousel__product-price.typescale",
                    label: "Typescale",
                  },
                  {
                    type: "select",
                    path: "carousel__product-price.textTransform",
                    label: "Capitalization",
                    options: CAPITALIZATION_OPTIONS,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "carousel__nav-button",
        displayName: "Scroll Button",
        styleFields: [
          // Border & Background
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
            type: "radius",
            path: "carousel__nav-button.borderRadius",
            label: "Rounding",
          },
          // Icon section
          {
            type: "color",
            path: "carousel__nav-button.color",
            label: "Color",
            section: "Icon",
          },
          {
            type: "number",
            path: "carousel__nav-button-icon.size",
            label: "Size",
            section: "Icon",
            unit: "px",
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
    displayName: "Banner",
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
    ],
    styleFields: [
      {
        type: "color",
        path: "banner.borderColor",
        label: "Border Color",
      },
      {
        type: "radius",
        path: "banner.borderRadius",
        label: "Rounding",
      },
    ],
    children: [
      {
        id: "banner__subline",
        displayName: "Subheadline",
        configFields: [
          {
            type: "toggle",
            path: "cta.bannerShowSubline",
            label: "Show Subheadline",
          },
          { type: "text", path: "cta.bannerSubline", label: "Text" },
        ],
        styleFields: [
          { type: "color", path: "banner__subline.color", label: "Color" },
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
        ],
      },
      {
        id: "banner__button",
        displayName: "Button",
        configFields: [
          { type: "text", path: "cta.bannerCTAText", label: "Label" },
          { type: "url", path: "cta.bannerCTAUrl", label: "Link" },
        ],
        styleFields: [
          // Border & Background
          {
            type: "color",
            path: "banner__button.borderColor",
            label: "Border Color",
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
          // Label section
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
      { type: "color", path: "footer.borderColor", label: "Border Color" },
      {
        type: "color",
        path: "footer.backgroundColor",
        label: "Background",
      },
    ],
    children: [
      {
        id: "footer__legal-name",
        displayName: "Brand",
        styleFields: [
          {
            type: "color",
            path: "footer__legal-name.color",
            label: "Color",
          },
          {
            type: "typescale",
            path: "footer__legal-name.typescale",
            label: "Typescale",
          },
          {
            type: "select",
            path: "footer__legal-name.textTransform",
            label: "Capitalization",
            options: CAPITALIZATION_OPTIONS,
          },
        ],
      },
      {
        id: "footer__social-icons",
        displayName: "Socials",
        styleFields: [
          {
            type: "color",
            path: "footer__social-icons.color",
            label: "Color",
          },
          {
            type: "typescale",
            path: "footer__social-icons.typescale",
            label: "Typescale",
          },
          {
            type: "select",
            path: "footer__social-icons.textTransform",
            label: "Capitalization",
            options: CAPITALIZATION_OPTIONS,
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
 * Check if a component has editable content (styleFields or configFields).
 * Used to determine if clicking should navigate to editor or just expand.
 */
export function hasEditableContent(component: ComponentDefinition): boolean {
  const hasStyles = (component.styleFields?.length ?? 0) > 0;
  const hasConfig = (component.configFields?.length ?? 0) > 0;
  return hasStyles || hasConfig;
}

/**
 * Check if a CSS class name is a selectable component in the preview.
 * Returns false for groupings (logical groupings that don't have a corresponding CSS class).
 */
export function isSelectableComponent(className: string): boolean {
  const component = findComponentById(className);
  if (!component) return false;
  // Groupings are not selectable in the preview
  if (component.isGrouping) return false;
  return true;
}
