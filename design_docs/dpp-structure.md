# DPP visual structure and theming hooks

## Layout and component tree
- `app/[brand]/[upid]/page.tsx` renders the DPP with `ThemeInjector` + `Header`, `ContentFrame`, and `Footer`.
- `Header`: fixed, two rows (brand logo/text, “Powered by Avelero”); classes `header`, `header__text-logo`.
- `ContentFrame`: main column wrapper.
  - `ImageAndInfo` (two-column layout):
    - `ProductImage`: sticky image area with zoom/position controls; class `product__image`.
    - `InformationFrame`: stacks the detail sections in order and trims trailing padding on the last visible block.
      - `ProductDescription`: brand/tagline/title/description with show more; classes `product__brand`, `product__title`, `product__description`, `product__show-more`.
      - `ProductDetails`: labeled rows (article no, manufacturer, origin, category, size, color); classes `product-details`, `product-details__row`, `product-details__row-label`, `product-details__row-value`, `product-details__row-link`.
      - `MenuFrame` (primary / secondary): list of `MenuButton`s with chevron; class `menu-button`.
      - `ImpactFrame`: heading + `LargeImpactCard` list, optional `SmallImpactFrame` for claims.
        - `LargeImpactCard` classes: `impact-card`, `impact-card__title`, `impact-card__type`, `impact-card__value`, `impact-card__unit`, icon color classes (`impact-card__icon-leaf|drop|recycle|factory`).
        - `SmallImpactCard` classes: `impact-card__eco-claim`, `impact-card__eco-claim-text`.
      - `MaterialsFrame`: title + grid of materials with optional certification pill; classes `materials-card`, `materials-card__title`, `materials-card__percentage`, `materials-card__type`, `materials-card__certification`, `materials-card__origin`, `materials-card__certification-text`.
      - `JourneyFrame`: vertical timeline; classes `journey-card`, `journey-card__title`, `journey-card__line`, `journey-card__type`, `journey-card__operator`.
      - `MenuFrame` (secondary) repeats for footer menu if enabled.
  - `ProductCarousel`: horizontally scrolling similar products with prev/next buttons; classes `carousel__title`, `carousel__nav-button`, `carousel__product-image`, `carousel__product-details`, `carousel__product-name`, `carousel__product-price`.
  - `CTABanner`: full-width CTA with optional logo, subline, and button; classes `banner`, `banner__container`, `banner__subline`, `banner__button`.
- `Footer`: legal name + social icons/text; classes `footer`, `footer__legal-name`, `footer__social-icons`.

## Theming surface (mirrors `apps/dpp/src/styles/globals.css`)
- Design tokens (root CSS vars) override-able via `ThemeStyles`: `colors` (`--background`, `--foreground`, `--primary`, `--secondary`, `--accent`, `--highlight`, `--success`, `--border`, `--ring`, etc.) and `typography` scales (`--type-h1` … `--type-body-xs`).
- Component-level CSS custom properties map 1:1 to the class names above (prefixes follow the same names as the `ThemeStyles` keys). Examples:
  - Header/footer: `header`, `header__text-logo`, `footer`, `footer__legal-name`, `footer__social-icons`.
  - Product: `product__image`, `product__title`, `product__description`, `product__brand`, `product__show-more`.
  - Details: `product-details`, `product-details__row`, `product-details__row-label`, `product-details__row-value`, `product-details__row-link`.
  - Impact: `impact-card`, `impact-card__title|type|value|unit`, `impact-card__eco-claim`, `impact-card__eco-claim-text`, icon color classes.
  - Materials: `materials-card`, `materials-card__title|percentage|type|certification|origin|certification-text`.
  - Journey: `journey-card`, `journey-card__title|line|type|operator`.
  - Carousel: `carousel__title`, `carousel__nav-button`, `carousel__product-image`, `carousel__product-details`, `carousel__product-name`, `carousel__product-price`.
  - Banner: `banner`, `banner__container`, `banner__subline`, `banner__button`.
- Token defaults and class-level fallbacks live in `apps/dpp/src/styles/globals.css`; overrides come from `ThemeStyles` → CSS variables, keeping base styles intact.

## Data/config inputs
- Theme config (`ThemeConfig`): branding logos/heights, menus, CTA banner content, social links + icon/text toggle, section visibility flags, image positioning/zoom, materials certification toggle.
- Theme styles (`ThemeStyles`): color/typography tokens, component class overrides, optional `customFonts`.
- Product data (`DppData`): product core info, materials, journey stages, impact metrics/claims, and similar products used by the carousel.
