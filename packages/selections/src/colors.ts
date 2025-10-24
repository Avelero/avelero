/*
  Predefined color database for textile and apparel industry.
  Single source of truth for color options with hex values.
*/

export interface Color {
  name: string;
  hex: string; // Without the # prefix
}

// Common fashion and textile industry colors
export const colors: Record<string, Color> = {
  BLACK: {
    name: "Black",
    hex: "000000",
  },
  WHITE: {
    name: "White",
    hex: "FFFFFF",
  },
  IVORY: {
    name: "Ivory",
    hex: "FFFFF0",
  },
  BEIGE: {
    name: "Beige",
    hex: "F5F5DC",
  },
  CREAM: {
    name: "Cream",
    hex: "FFFDD0",
  },
  NAVY: {
    name: "Navy",
    hex: "000080",
  },
  ROYAL_BLUE: {
    name: "Royal Blue",
    hex: "4169E1",
  },
  SKY_BLUE: {
    name: "Sky Blue",
    hex: "87CEEB",
  },
  LIGHT_BLUE: {
    name: "Light Blue",
    hex: "ADD8E6",
  },
  TEAL: {
    name: "Teal",
    hex: "008080",
  },
  TURQUOISE: {
    name: "Turquoise",
    hex: "40E0D0",
  },
  FOREST_GREEN: {
    name: "Forest Green",
    hex: "228B22",
  },
  OLIVE_GREEN: {
    name: "Olive Green",
    hex: "808000",
  },
  EMERALD: {
    name: "Emerald",
    hex: "50C878",
  },
  MINT: {
    name: "Mint",
    hex: "98FF98",
  },
  SAGE: {
    name: "Sage",
    hex: "9DC183",
  },
  BURGUNDY: {
    name: "Burgundy",
    hex: "800020",
  },
  CRIMSON: {
    name: "Crimson",
    hex: "DC143C",
  },
  CORAL: {
    name: "Coral",
    hex: "FF7F50",
  },
  SALMON: {
    name: "Salmon",
    hex: "FA8072",
  },
  BLUSH: {
    name: "Blush",
    hex: "FFC0CB",
  },
  ROSE: {
    name: "Rose",
    hex: "FF007F",
  },
  LAVENDER: {
    name: "Lavender",
    hex: "E6E6FA",
  },
  PURPLE: {
    name: "Purple",
    hex: "800080",
  },
  PLUM: {
    name: "Plum",
    hex: "DDA0DD",
  },
  MAUVE: {
    name: "Mauve",
    hex: "E0B0FF",
  },
  MUSTARD: {
    name: "Mustard",
    hex: "FFDB58",
  },
  GOLD: {
    name: "Gold",
    hex: "FFD700",
  },
  CAMEL: {
    name: "Camel",
    hex: "C19A6B",
  },
  TAN: {
    name: "Tan",
    hex: "D2B48C",
  },
  BROWN: {
    name: "Brown",
    hex: "A52A2A",
  },
  CHOCOLATE: {
    name: "Chocolate",
    hex: "7B3F00",
  },
  GRAY: {
    name: "Gray",
    hex: "808080",
  },
  CHARCOAL: {
    name: "Charcoal",
    hex: "36454F",
  },
  SILVER: {
    name: "Silver",
    hex: "C0C0C0",
  },
  KHAKI: {
    name: "Khaki",
    hex: "C3B091",
  },
  ORANGE: {
    name: "Orange",
    hex: "FFA500",
  },
  RUST: {
    name: "Rust",
    hex: "B7410E",
  },
  TERRACOTTA: {
    name: "Terracotta",
    hex: "E2725B",
  },
  PEACH: {
    name: "Peach",
    hex: "FFE5B4",
  },
  DENIM_BLUE: {
    name: "Denim Blue",
    hex: "1560BD",
  },
  STONE: {
    name: "Stone",
    hex: "928E85",
  },
  SAND: {
    name: "Sand",
    hex: "C2B280",
  },
  LILAC: {
    name: "Lilac",
    hex: "C8A2C8",
  },
  MAROON: {
    name: "Maroon",
    hex: "800000",
  },
  WINE: {
    name: "Wine",
    hex: "722F37",
  },
} as const;

export const allColors: Color[] = Object.values(colors);

export type ColorName = keyof typeof colors;
