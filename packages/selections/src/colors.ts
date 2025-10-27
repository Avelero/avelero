/*
  Predefined color database with default shades.
  Single source of truth for color options with hex values.
*/

export interface Color {
  name: string;
  hex: string; // Without the # prefix
}

// Basic colors with default (500) shades - matches colorFamilies below
export const colors = {
  RED: {
    name: "Red",
    hex: "EF4444",
  },
  ORANGE: {
    name: "Orange",
    hex: "F97316",
  },
  AMBER: {
    name: "Amber",
    hex: "F59E0B",
  },
  YELLOW: {
    name: "Yellow",
    hex: "EAB308",
  },
  LIME: {
    name: "Lime",
    hex: "84CC16",
  },
  GREEN: {
    name: "Green",
    hex: "10B981",
  },
  EMERALD: {
    name: "Emerald",
    hex: "10B981",
  },
  TEAL: {
    name: "Teal",
    hex: "14B8A6",
  },
  CYAN: {
    name: "Cyan",
    hex: "06B6D4",
  },
  SKY: {
    name: "Sky",
    hex: "0EA5E9",
  },
  BLUE: {
    name: "Blue",
    hex: "3B82F6",
  },
  INDIGO: {
    name: "Indigo",
    hex: "6366F1",
  },
  VIOLET: {
    name: "Violet",
    hex: "8B5CF6",
  },
  PURPLE: {
    name: "Purple",
    hex: "A855F7",
  },
  FUCHSIA: {
    name: "Fuchsia",
    hex: "D946EF",
  },
  PINK: {
    name: "Pink",
    hex: "EC4899",
  },
  ROSE: {
    name: "Rose",
    hex: "F43F5E",
  },
  STONE: {
    name: "Stone",
    hex: "78716C",
  },
  ZINC: {
    name: "Zinc",
    hex: "71717A",
  },
  GRAY: {
    name: "Gray",
    hex: "6B7280",
  },
  SLATE: {
    name: "Slate",
    hex: "64748B",
  },
} satisfies Record<string, Color>;

export const allColors: Color[] = Object.values(colors);

export type ColorName = keyof typeof colors;

// Expansive color palette with shades for detailed color selection
export interface ColorFamily {
  name: string;
  shades: string[]; // Array of hex values (without # prefix)
}

export const SHADE_LABELS = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];

export const colorFamilies: ColorFamily[] = [
  {
    name: "Red",
    shades: [
      "FEE2E2",
      "FECACA",
      "FCA5A5",
      "F87171",
      "EF4444",
      "DC2626",
      "B91C1C",
      "991B1B",
      "7F1D1D",
      "7F1D1D",
    ],
  },
  {
    name: "Orange",
    shades: [
      "FFEDD5",
      "FED7AA",
      "FDBA74",
      "FB923C",
      "F97316",
      "EA580C",
      "C2410C",
      "9A3412",
      "7C2D12",
      "7C2D12",
    ],
  },
  {
    name: "Amber",
    shades: [
      "FEF3C7",
      "FDE68A",
      "FCD34D",
      "FBBF24",
      "F59E0B",
      "D97706",
      "B45309",
      "92400E",
      "78350F",
      "78350F",
    ],
  },
  {
    name: "Yellow",
    shades: [
      "FEF9C3",
      "FEF08A",
      "FDE047",
      "FACC15",
      "EAB308",
      "CA8A04",
      "A16207",
      "854D0E",
      "713F12",
      "713F12",
    ],
  },
  {
    name: "Lime",
    shades: [
      "ECFCCB",
      "D9F99D",
      "BEF264",
      "A3E635",
      "84CC16",
      "65A30D",
      "4D7C0F",
      "3F6212",
      "365314",
      "365314",
    ],
  },
  {
    name: "Green",
    shades: [
      "D1FAE5",
      "A7F3D0",
      "6EE7B7",
      "34D399",
      "10B981",
      "059669",
      "047857",
      "065F46",
      "064E3B",
      "064E3B",
    ],
  },
  {
    name: "Emerald",
    shades: [
      "D1FAE5",
      "A7F3D0",
      "6EE7B7",
      "34D399",
      "10B981",
      "059669",
      "047857",
      "065F46",
      "064E3B",
      "064E3B",
    ],
  },
  {
    name: "Teal",
    shades: [
      "CCFBF1",
      "99F6E4",
      "5EEAD4",
      "2DD4BF",
      "14B8A6",
      "0D9488",
      "0F766E",
      "115E59",
      "134E4A",
      "134E4A",
    ],
  },
  {
    name: "Cyan",
    shades: [
      "CFFAFE",
      "A5F3FC",
      "67E8F9",
      "22D3EE",
      "06B6D4",
      "0891B2",
      "0E7490",
      "155E75",
      "164E63",
      "164E63",
    ],
  },
  {
    name: "Sky",
    shades: [
      "E0F2FE",
      "BAE6FD",
      "7DD3FC",
      "38BDF8",
      "0EA5E9",
      "0284C7",
      "0369A1",
      "075985",
      "0C4A6E",
      "0C4A6E",
    ],
  },
  {
    name: "Blue",
    shades: [
      "DBEAFE",
      "BFDBFE",
      "93C5FD",
      "60A5FA",
      "3B82F6",
      "2563EB",
      "1D4ED8",
      "1E40AF",
      "1E3A8A",
      "1E3A8A",
    ],
  },
  {
    name: "Indigo",
    shades: [
      "E0E7FF",
      "C7D2FE",
      "A5B4FC",
      "818CF8",
      "6366F1",
      "4F46E5",
      "4338CA",
      "3730A3",
      "312E81",
      "312E81",
    ],
  },
  {
    name: "Violet",
    shades: [
      "EDE9FE",
      "DDD6FE",
      "C4B5FD",
      "A78BFA",
      "8B5CF6",
      "7C3AED",
      "6D28D9",
      "5B21B6",
      "4C1D95",
      "4C1D95",
    ],
  },
  {
    name: "Purple",
    shades: [
      "F3E8FF",
      "E9D5FF",
      "D8B4FE",
      "C084FC",
      "A855F7",
      "9333EA",
      "7E22CE",
      "6B21A8",
      "581C87",
      "581C87",
    ],
  },
  {
    name: "Fuchsia",
    shades: [
      "FAE8FF",
      "F5D0FE",
      "F0ABFC",
      "E879F9",
      "D946EF",
      "C026D3",
      "A21CAF",
      "86198F",
      "701A75",
      "701A75",
    ],
  },
  {
    name: "Pink",
    shades: [
      "FCE7F3",
      "FBCFE8",
      "F9A8D4",
      "F472B6",
      "EC4899",
      "DB2777",
      "BE185D",
      "9D174D",
      "831843",
      "831843",
    ],
  },
  {
    name: "Rose",
    shades: [
      "FFE4E6",
      "FECDD3",
      "FDA4AF",
      "FB7185",
      "F43F5E",
      "E11D48",
      "BE123C",
      "9F1239",
      "881337",
      "881337",
    ],
  },
  {
    name: "Stone",
    shades: [
      "F5F5F4",
      "E7E5E4",
      "D6D3D1",
      "A8A29E",
      "78716C",
      "57534E",
      "44403C",
      "292524",
      "1C1917",
      "1C1917",
    ],
  },
  {
    name: "Zinc",
    shades: [
      "F4F4F5",
      "E4E4E7",
      "D4D4D8",
      "A1A1AA",
      "71717A",
      "52525B",
      "3F3F46",
      "27272A",
      "18181B",
      "18181B",
    ],
  },
  {
    name: "Gray",
    shades: [
      "F3F4F6",
      "E5E7EB",
      "D1D5DB",
      "9CA3AF",
      "6B7280",
      "4B5563",
      "374151",
      "1F2937",
      "111827",
      "111827",
    ],
  },
  {
    name: "Slate",
    shades: [
      "F1F5F9",
      "E2E8F0",
      "CBD5E1",
      "94A3B8",
      "64748B",
      "475569",
      "334155",
      "1E293B",
      "0F172A",
      "0F172A",
    ],
  },
];
