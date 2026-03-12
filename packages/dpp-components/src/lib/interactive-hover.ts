/**
 * Interactive hover helpers for theme-driven passport controls.
 *
 * Derives subtle hover colors from resolved theme colors in OKLCH space so
 * interactive states stay perceptually balanced across custom palettes.
 */

const INTERACTIVE_HOVER_LIGHTNESS_PIVOT = 0.6;
const INTERACTIVE_HOVER_WEBER_FRACTION = 0.01571;
const INTERACTIVE_HOVER_DARK_ADAPTATION_OFFSET = 2.7435;

type ParsedColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type OklabColor = {
  l: number;
  a: number;
  b: number;
  alpha: number;
};

type OklchColor = {
  l: number;
  c: number;
  h: number;
  alpha: number;
};

type InteractiveHoverStyle = React.CSSProperties & {
  "--dpp-interactive-background"?: string;
  "--dpp-interactive-base-background"?: string;
  "--dpp-interactive-hover-background"?: string;
  "--dpp-interactive-color"?: string;
  "--dpp-interactive-base-color"?: string;
  "--dpp-interactive-hover-color"?: string;
};

export const INTERACTIVE_HOVER_CLASS_NAME = "dpp-interactive-hover";

function clampByte(value: number): number {
  // Keep RGB channels inside the valid 0-255 range.
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampUnitInterval(value: number): number {
  // Keep normalized values like alpha and mix ratios between 0 and 1.
  return Math.min(1, Math.max(0, value));
}

function parseHexColor(value: string): ParsedColor | null {
  // Parse #RGB, #RGBA, #RRGGBB, and #RRGGBBAA inputs from the theme editor.
  const hex = value.trim();

  if (!hex.startsWith("#")) {
    return null;
  }

  const normalized = hex.slice(1);
  if (![3, 4, 6, 8].includes(normalized.length)) {
    return null;
  }

  const expanded =
    normalized.length <= 4
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const hasAlpha = expanded.length === 8;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: hasAlpha ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRgbColor(value: string): ParsedColor | null {
  // Parse rgb() and rgba() strings for overrides that are already resolved to CSS colors.
  const match = value
    .trim()
    .match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
    );

  if (!match) {
    return null;
  }

  const [, r, g, b, a] = match;
  return {
    r: clampByte(Number.parseFloat(r ?? "0")),
    g: clampByte(Number.parseFloat(g ?? "0")),
    b: clampByte(Number.parseFloat(b ?? "0")),
    a: clampUnitInterval(Number.parseFloat(a ?? "1")),
  };
}

function parseColor(value: string | undefined): ParsedColor | null {
  // Accept the resolved color strings produced by the passport style system.
  if (!value) {
    return null;
  }

  return parseHexColor(value) ?? parseRgbColor(value);
}

function toLinearChannel(channel: number): number {
  // Convert an sRGB channel into linear-light RGB for OKLab conversion.
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function toSrgbChannel(channel: number): number {
  // Convert a linear-light RGB channel back into display sRGB.
  const normalized =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * channel ** (1 / 2.4) - 0.055;

  return clampByte(normalized * 255);
}

function rgbToOklab(color: ParsedColor): OklabColor {
  // Transform sRGB into OKLab so hover shifts can happen in perceptual space.
  const r = toLinearChannel(color.r);
  const g = toLinearChannel(color.g);
  const b = toLinearChannel(color.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha: color.a,
  };
}

function oklabToOklch(color: OklabColor): OklchColor {
  // Split OKLab into lightness, chroma, and hue for simpler hover adjustments.
  return {
    l: color.l,
    c: Math.sqrt(color.a ** 2 + color.b ** 2),
    h: Math.atan2(color.b, color.a),
    alpha: color.alpha,
  };
}

function oklchToOklab(color: OklchColor): OklabColor {
  // Rebuild OKLab coordinates after tweaking lightness and chroma.
  return {
    l: color.l,
    a: color.c * Math.cos(color.h),
    b: color.c * Math.sin(color.h),
    alpha: color.alpha,
  };
}

function oklabToRgb(color: OklabColor): ParsedColor {
  // Convert the adjusted perceptual color back into displayable sRGB.
  const l = color.l + 0.3963377774 * color.a + 0.2158037573 * color.b;
  const m = color.l - 0.1055613458 * color.a - 0.0638541728 * color.b;
  const s = color.l - 0.0894841775 * color.a - 1.291485548 * color.b;

  const l3 = l ** 3;
  const m3 = m ** 3;
  const s3 = s ** 3;

  return {
    r: toSrgbChannel(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    g: toSrgbChannel(
      -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    ),
    b: toSrgbChannel(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
    a: color.alpha,
  };
}

function formatColor(color: ParsedColor): string {
  // Emit a browser-friendly rgba() string while preserving alpha.
  const alpha = Math.round(color.a * 1000) / 1000;
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function getHoverLightness(lightness: number): number {
  // Apply a Weber-law luminance shift with a dark-adaptation offset.
  const luminance = lightness ** 3;
  const deltaLuminance =
    INTERACTIVE_HOVER_WEBER_FRACTION *
    (luminance + INTERACTIVE_HOVER_DARK_ADAPTATION_OFFSET);
  const direction = lightness > INTERACTIVE_HOVER_LIGHTNESS_PIVOT ? -1 : 1;
  const hoverLuminance = clampUnitInterval(
    luminance + direction * deltaLuminance,
  );

  return Math.cbrt(hoverLuminance);
}

export function deriveInteractiveHoverColor(
  value: string | undefined,
): string | undefined {
  // Shift only OKLCH lightness with an asymmetric curve while preserving hue and chroma.
  const color = parseColor(value);
  if (!color) {
    return undefined;
  }

  const baseColor = oklabToOklch(rgbToOklab(color));
  const hoverColor: OklchColor = {
    l: clampUnitInterval(getHoverLightness(baseColor.l)),
    c: baseColor.c,
    h: baseColor.h,
    alpha: baseColor.alpha,
  };

  return formatColor(oklabToRgb(oklchToOklab(hoverColor)));
}

export function createInteractiveHoverStyle(
  style: React.CSSProperties | undefined,
  options: {
    background?: boolean;
    color?: boolean;
  },
): React.CSSProperties {
  // Replace direct colors with CSS variables so hover can swap them without extra runtime work.
  const nextStyle: InteractiveHoverStyle = { ...(style ?? {}) };

  if (options.background && typeof nextStyle.backgroundColor === "string") {
    const hoverBackground = deriveInteractiveHoverColor(
      nextStyle.backgroundColor,
    );

    if (hoverBackground) {
      nextStyle["--dpp-interactive-base-background"] =
        nextStyle.backgroundColor;
      nextStyle["--dpp-interactive-hover-background"] = hoverBackground;
      nextStyle.backgroundColor =
        "var(--dpp-interactive-background, var(--dpp-interactive-base-background))";
    }
  }

  if (options.color && typeof nextStyle.color === "string") {
    const hoverColor = deriveInteractiveHoverColor(nextStyle.color);

    if (hoverColor) {
      nextStyle["--dpp-interactive-base-color"] = nextStyle.color;
      nextStyle["--dpp-interactive-hover-color"] = hoverColor;
      nextStyle.color =
        "var(--dpp-interactive-color, var(--dpp-interactive-base-color))";
    }
  }

  return nextStyle;
}
