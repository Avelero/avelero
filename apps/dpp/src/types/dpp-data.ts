/**
 * Public DPP Data Types
 * These represent the product information that will be fetched from the public REST API
 */

export interface Material {
  percentage: number;
  type: string;
  origin: string;
  certification?: string;
  certificationUrl?: string;
}

export interface JourneyStage {
  name: string;
  companies: Array<{
    name: string;
    location: string;
  }>;
}

export interface ImpactMetric {
  type: string;
  value: string;
  unit: string;
  icon: "leaf" | "drop" | "recycle" | "factory";
  iconColor?: string;
}

export interface SimilarProduct {
  image: string;
  name: string;
  price: number;
  currency?: string;
  url?: string;
}

export interface DppData {
  // Core product info
  title: string;
  brandName: string;
  productImage: string;
  description: string;
  size: string;
  color: string;
  category: string;
  articleNumber: string;
  manufacturer: string;
  countryOfOrigin: string;

  // Materials
  materials: Material[];

  // Supply chain journey
  journey: JourneyStage[];

  // Environmental impact
  impactMetrics: ImpactMetric[];
  impactClaims: string[];

  // Similar products
  similarProducts: SimilarProduct[];
}
