/**
 * Section registry — maps section types to their components and schemas.
 *
 * Used by the layout renderer to look up components at render time,
 * and by the theme editor to discover editable fields and defaults.
 */

import type { DppContent } from "../types/dpp-content";
import type { DppData } from "../types/dpp-data";
import type {
  Passport,
  Section,
  SectionType,
  Styles,
  ZoneId,
} from "../types/passport";
import { BannerSection } from "./banner";
import { BANNER_SCHEMA } from "./banner/schema";
import { ButtonsSection } from "./buttons";
import { BUTTONS_SCHEMA } from "./buttons/schema";
import { CarouselSection } from "./carousel";
import { CAROUSEL_SCHEMA } from "./carousel/schema";
import { DescriptionSection } from "./description";
import { DESCRIPTION_SCHEMA } from "./description/schema";
import { DetailsSection } from "./details";
import { DETAILS_SCHEMA } from "./details/schema";
import { HeroSection } from "./hero";
import { HERO_SCHEMA } from "./hero/schema";
import { ImpactSection } from "./impact";
import { IMPACT_SCHEMA } from "./impact/schema";
import { JourneySection } from "./journey";
import { JOURNEY_SCHEMA } from "./journey/schema";
import { MaterialsSection } from "./materials";
import { MATERIALS_SCHEMA } from "./materials/schema";

// ─── Editor Types ───────────────────────────────────────────────────────────

export type StyleFieldType =
  | "color"
  | "number"
  | "radius"
  | "border"
  | "select"
  | "typescale"
  | "toggle";

export interface StyleField {
  type: StyleFieldType;
  path: string;
  label: string;
  unit?: "px" | "%" | "em" | "rem";
  options?: Array<{ value: string; label: string }>;
  section?: string;
}

export type ContentFieldType =
  | "text"
  | "textarea"
  | "url"
  | "image"
  | "toggle"
  | "number"
  | "modal";

export interface ContentField {
  type: ContentFieldType;
  path: string;
  label: string;
  placeholder?: string;
  section?: string;
  modalType?: "menu-primary" | "menu-secondary" | "carousel-products";
  min?: number;
  max?: number;
}

export interface ComponentDefinition {
  id: string;
  displayName: string;
  children?: ComponentDefinition[];
  styleFields?: StyleField[];
  configFields?: ContentField[];
  isGrouping?: boolean;
}

// ─── Section Props ───────────────────────────────────────────────────────────

/** Props passed to every section component by the layout renderer. */
export interface SectionProps {
  section: Section;
  tokens: Passport["tokens"];
  data: DppData;
  zoneId: ZoneId;
  content?: DppContent;
  wrapperClassName?: string;
}

// ─── Section Schema ──────────────────────────────────────────────────────────

/** Schema describing a section type for the editor and defaults. */
export interface SectionSchema {
  type: SectionType;
  displayName: string;
  allowedZones: ZoneId[];
  defaultContent: Record<string, unknown>;
  defaultStyles: Styles;
  editorTree: ComponentDefinition;
}

// ─── Registry ────────────────────────────────────────────────────────────────

export interface SectionRegistryEntry {
  schema: SectionSchema;
  component: React.ComponentType<SectionProps>;
}

export const SECTION_REGISTRY: Record<SectionType, SectionRegistryEntry> = {
  hero: { schema: HERO_SCHEMA, component: HeroSection },
  description: { schema: DESCRIPTION_SCHEMA, component: DescriptionSection },
  details: { schema: DETAILS_SCHEMA, component: DetailsSection },
  buttons: { schema: BUTTONS_SCHEMA, component: ButtonsSection },
  impact: { schema: IMPACT_SCHEMA, component: ImpactSection },
  materials: { schema: MATERIALS_SCHEMA, component: MaterialsSection },
  journey: { schema: JOURNEY_SCHEMA, component: JourneySection },
  banner: { schema: BANNER_SCHEMA, component: BannerSection },
  carousel: { schema: CAROUSEL_SCHEMA, component: CarouselSection },
};
