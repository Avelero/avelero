import type { Passport, PassportStatus, PassportTemplate } from "./types";

const STATUSES: PassportStatus[] = [
  "published",
  "scheduled",
  "unpublished",
  "archived",
];

const SEASONS = ["SS26", "AW25", "SS25", "AW24"] as const;

interface BaseProductSpec {
  title: string;
  category: string;
  categoryPath: string[];
}

const BASE_PRODUCTS: BaseProductSpec[] = [
  {
    title: "Spectacular Jacket White",
    category: "Apparel",
    categoryPath: ["Apparel", "Outerwear", "Jackets"],
  },
  {
    title: "Violet Jacket White",
    category: "Apparel",
    categoryPath: ["Apparel", "Outerwear", "Jackets"],
  },
  {
    title: "Dazzling Boots",
    category: "Footwear",
    categoryPath: ["Footwear", "Boots"],
  },
  {
    title: "Dazzling Sneaker",
    category: "Footwear",
    categoryPath: ["Footwear", "Sneakers"],
  },
  {
    title: "Flattered Boots",
    category: "Apparel",
    categoryPath: ["Apparel", "Footwear", "Boots"],
  },
  {
    title: "Red Pants",
    category: "Apparel",
    categoryPath: ["Apparel", "Bottoms", "Pants"],
  },
  {
    title: "Spectacular Boots Red",
    category: "Apparel",
    categoryPath: ["Apparel", "Footwear", "Boots"],
  },
  {
    title: "Amazing Pants Violet",
    category: "Apparel",
    categoryPath: ["Apparel", "Bottoms", "Pants"],
  },
];

const TEMPLATES: PassportTemplate[] = [
  { id: "tpl-1", name: "Apparel / SS26", color: "#8B5CF6" },
  { id: "tpl-2", name: "Footwear / SS26", color: "#F59E0B" },
  { id: "tpl-3", name: "Apparel / AW25", color: "#3B82F6" },
  { id: "tpl-4", name: "Organic Apparel", color: "#10B981" },
];

function pad(number: number, width: number): string {
  const str = String(number);
  return str.length >= width ? str : `${"0".repeat(width - str.length)}${str}`;
}

function createPassport(
  index: number,
  spec: BaseProductSpec,
  template: PassportTemplate,
): Passport {
  const status = STATUSES[index % STATUSES.length]!;
  const totalSections = 6;
  const completedSections = (index % (totalSections + 1)) as number;
  const season = SEASONS[index % SEASONS.length]!;
  const sku = `${index % 2 === 0 ? "92" : "56"}${pad(409200 + index * 37, 6)}`;
  const id = `p-${pad(index + 1, 6)}`;

  return {
    id,
    title: spec.title,
    sku,
    status,
    completedSections,
    totalSections,
    category: spec.category,
    categoryPath: spec.categoryPath,
    season,
    template,
    passportUrl:
      status === "published"
        ? `https://passports.example.com/${sku}`
        : undefined,
    primaryImageUrl: undefined,
    createdAt: new Date(
      Date.now() - 1000 * 60 * 60 * 24 * (index + 5),
    ).toISOString(),
    updatedAt: new Date(
      Date.now() - 1000 * 60 * 60 * 12 * (index + 2),
    ).toISOString(),
  };
}

function generateMockPassports(count: number): Passport[] {
  const items: Passport[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = BASE_PRODUCTS[i % BASE_PRODUCTS.length]!;
    const template = TEMPLATES[i % TEMPLATES.length]!;
    items.push(createPassport(i, base, template));
  }
  return items;
}

export const mockPassports: Passport[] = generateMockPassports(60);

export async function getMockPassports(
  page: number,
  pageSize: number,
): Promise<{ data: Passport[]; meta: { total: number; hasMore: boolean } }> {
  // Simulate a small network delay to better exercise loading states
  await new Promise((resolve) => setTimeout(resolve, 300));

  const start = Math.max(0, page * pageSize);
  const end = start + pageSize;
  const data = mockPassports.slice(start, end);
  return {
    data,
    meta: { total: mockPassports.length, hasMore: end < mockPassports.length },
  } as const;
}
