/*
  Predefined production/manufacturing steps for textile and apparel supply chain.
  Single source of truth for journey step options.
*/

export interface ProductionStep {
  id: string;
  name: string;
  description?: string;
  category:
    | "material"
    | "processing"
    | "manufacturing"
    | "finishing"
    | "quality";
}

export const productionSteps: Record<string, ProductionStep> = {
  RAW_MATERIAL: {
    id: "raw-material",
    name: "Raw Material",
    description: "Sourcing and processing of raw materials",
    category: "material",
  },
  FIBER_PRODUCTION: {
    id: "fiber-production",
    name: "Fiber Production",
    description: "Creating or extracting fibers from raw materials",
    category: "material",
  },
  SPINNING: {
    id: "spinning",
    name: "Spinning",
    description: "Converting fibers into yarn or thread",
    category: "processing",
  },
  WEAVING: {
    id: "weaving",
    name: "Weaving",
    description: "Interlacing yarns to create fabric",
    category: "processing",
  },
  KNITTING: {
    id: "knitting",
    name: "Knitting",
    description: "Interlocking loops of yarn to form fabric",
    category: "processing",
  },
  DYEING: {
    id: "dyeing",
    name: "Dyeing",
    description: "Adding color to fabric or garments",
    category: "processing",
  },
  PRINTING: {
    id: "printing",
    name: "Printing",
    description: "Applying patterns or designs to fabric",
    category: "processing",
  },
  WASHING: {
    id: "washing",
    name: "Washing",
    description: "Pre-treatment or finishing wash process",
    category: "processing",
  },
  CUTTING: {
    id: "cutting",
    name: "Cutting",
    description: "Cutting fabric according to pattern pieces",
    category: "manufacturing",
  },
  SEWING: {
    id: "sewing",
    name: "Sewing",
    description: "Stitching fabric pieces together",
    category: "manufacturing",
  },
  ASSEMBLY: {
    id: "assembly",
    name: "Assembly",
    description: "Assembling garment components",
    category: "manufacturing",
  },
  EMBROIDERY: {
    id: "embroidery",
    name: "Embroidery",
    description: "Adding decorative stitching or designs",
    category: "finishing",
  },
  FINISHING: {
    id: "finishing",
    name: "Finishing",
    description: "Final treatments and enhancements",
    category: "finishing",
  },
  PRESSING: {
    id: "pressing",
    name: "Pressing",
    description: "Ironing and steam pressing of garments",
    category: "finishing",
  },
  QUALITY_CONTROL: {
    id: "quality-control",
    name: "Quality Control",
    description: "Inspection and quality assurance checks",
    category: "quality",
  },
  TESTING: {
    id: "testing",
    name: "Testing",
    description: "Performance and safety testing",
    category: "quality",
  },
  LABELING: {
    id: "labeling",
    name: "Labeling",
    description: "Attaching care labels and tags",
    category: "finishing",
  },
  PACKAGING: {
    id: "packaging",
    name: "Packaging",
    description: "Final packaging for distribution",
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
  quality: allProductionSteps.filter((step) => step.category === "quality"),
};

// For simple dropdown usage - just the names
export const productionStepNames: string[] = allProductionSteps.map(
  (step) => step.name,
);

export type ProductionStepId = keyof typeof productionSteps;
