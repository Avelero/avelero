/**
 * Shared font defaults for passport configurations.
 */

import type { CustomFont } from "../types/passport";

export const DEFAULT_PASSPORT_FONT_FAMILY = "Switzer Variable";

export const DEFAULT_PASSPORT_FONT_URL =
  "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/fonts/Switzer-Variable.woff2";

export const DEFAULT_PASSPORT_FONT: CustomFont = {
  fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
  src: DEFAULT_PASSPORT_FONT_URL,
  fontWeight: "100 900",
  fontStyle: "normal",
  format: "woff2",
  fontDisplay: "swap",
};
