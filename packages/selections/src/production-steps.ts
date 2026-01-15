/*
  Predefined production/manufacturing steps for textile and apparel supply chain.
  Single source of truth for journey step options.
*/

export interface ProductionStep {
  id: string;
  name: string;
  description?: string;
  category: "material" | "processing" | "manufacturing" | "finishing";
}

export const productionSteps = {
  RAW_MATERIAL: {
    id: "raw-material",
    name: "Raw Material",
    description: "Sourcing and processing of raw materials",
    category: "material",
  },
  WEAVING: {
    id: "weaving",
    name: "Weaving",
    description: "Interlacing yarns to create fabric",
    category: "processing",
  },
  DYEING_PRINTING: {
    id: "dyeing-printing",
    name: "Dyeing / Printing",
    description: "Adding color, patterns, or designs to fabric",
    category: "processing",
  },
  STITCHING: {
    id: "stitching",
    name: "Stitching",
    description: "Stitching components together (footwear only)",
    category: "manufacturing",
  },
  ASSEMBLY: {
    id: "assembly",
    name: "Assembly",
    description: "Assembling product components",
    category: "manufacturing",
  },
  FINISHING: {
    id: "finishing",
    name: "Finishing",
    description: "Final treatments and enhancements",
    category: "finishing",
  },
} as const;

export const allProductionSteps: ProductionStep[] =
  Object.values(productionSteps);

// Grouped by category for easier filtering
export const productionStepsByCategory = {
  material: allProductionSteps.filter((step) => step.category === "material"),
  processing: allProductionSteps.filter(
    (step) => step.category === "processing",
  ),
  manufacturing: allProductionSteps.filter(
    (step) => step.category === "manufacturing",
  ),
  finishing: allProductionSteps.filter((step) => step.category === "finishing"),
};

// For simple dropdown usage - just the names
export const productionStepNames: string[] = allProductionSteps.map(
  (step) => step.name,
);

export type ProductionStepId = keyof typeof productionSteps;
