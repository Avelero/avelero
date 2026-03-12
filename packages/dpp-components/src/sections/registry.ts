/**
 * Section registry — maps section types to their components and schemas.
 *
 * Used by the layout renderer to look up components at render time,
 * and by the theme editor to discover editable fields.
 */

import type { SectionRegistryEntry } from "../types/editor";
import type { SectionType } from "../types/passport";
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
import { ImageCardsSection } from "./image-cards";
import { IMAGE_CARDS_SCHEMA } from "./image-cards/schema";
import { ImpactSection } from "./impact";
import { IMPACT_SCHEMA } from "./impact/schema";
import { JourneySection } from "./journey";
import { JOURNEY_SCHEMA } from "./journey/schema";
import { MaterialsSection } from "./materials";
import { MATERIALS_SCHEMA } from "./materials/schema";
import { SeparatorSection } from "./separator";
import { SEPARATOR_SCHEMA } from "./separator/schema";
import { TextSection } from "./text";
import { TextImageSection } from "./text-image";
import { TEXT_IMAGE_SCHEMA } from "./text-image/schema";
import { TEXT_SCHEMA } from "./text/schema";

// Re-export editor types for backward compatibility — section schemas and
// renderers import SectionSchema, SectionProps, ComponentDefinition etc. from
// this module. The canonical definitions now live in types/editor.ts.
export type {
  StyleFieldType,
  StyleFieldValue,
  StyleField,
  ContentFieldType,
  ContentField,
  ComponentDefinition,
  SectionProps,
  SectionDefaults,
  SectionSchema,
  SectionRegistryEntry,
  SectionVisibilityKey,
  FixedComponentSchema,
  FixedComponentRegistryEntry,
} from "../types/editor";

// ─── Registry ────────────────────────────────────────────────────────────────

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
  imageCards: {
    schema: IMAGE_CARDS_SCHEMA,
    component: ImageCardsSection,
  },
  text: { schema: TEXT_SCHEMA, component: TextSection },
  textImage: { schema: TEXT_IMAGE_SCHEMA, component: TextImageSection },
  separator: { schema: SEPARATOR_SCHEMA, component: SeparatorSection },
};
