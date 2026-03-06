/**
 * Layout migration utility.
 *
 * Converts existing ThemeConfig section visibility flags + menu/cta config
 * into a LayoutConfig. Used for one-time migration of existing brand configs.
 */

import type { LayoutComponentInstance } from "../types/layout-config";
import type { LayoutConfig } from "../types/layout-config";
import type { ThemeConfig } from "../types/theme-config";

let instanceCounter = 0;
function nextId(prefix: string): string {
  instanceCounter++;
  return `${prefix}_${instanceCounter}`;
}

/**
 * Generate a LayoutConfig from a ThemeConfig that doesn't have one yet.
 *
 * Reads sections.show* flags, menus, and cta to build the equivalent layout.
 * Call this once per migration, not on every render.
 */
export function generateDefaultLayout(
  config: Omit<ThemeConfig, "layout">,
): LayoutConfig {
  instanceCounter = 0;

  const columnLeft: LayoutComponentInstance[] = [
    { id: nextId("inst_img"), componentType: "image" },
  ];

  const columnRight: LayoutComponentInstance[] = [
    { id: nextId("inst_hero"), componentType: "hero" },
  ];

  if (config.sections.showProductDetails) {
    columnRight.push({
      id: nextId("inst_det"),
      componentType: "details",
    });
  }

  if (config.sections.showPrimaryMenu && config.menus.primary.length > 0) {
    columnRight.push({
      id: nextId("inst_btn"),
      componentType: "buttons",
      content: {
        items: config.menus.primary.map((item) => ({
          label: item.label,
          url: item.url,
        })),
        variant: "primary",
      },
    });
  }

  if (config.sections.showImpact) {
    columnRight.push({
      id: nextId("inst_imp"),
      componentType: "impact",
    });
  }

  if (config.sections.showMaterials) {
    columnRight.push({
      id: nextId("inst_mat"),
      componentType: "materials",
    });
  }

  if (config.sections.showJourney) {
    columnRight.push({
      id: nextId("inst_jrn"),
      componentType: "journey",
    });
  }

  if (config.sections.showSecondaryMenu && config.menus.secondary.length > 0) {
    columnRight.push({
      id: nextId("inst_btn"),
      componentType: "buttons",
      content: {
        items: config.menus.secondary.map((item) => ({
          label: item.label,
          url: item.url,
        })),
        variant: "secondary",
      },
    });
  }

  const content: LayoutComponentInstance[] = [];

  if (config.sections.showCTABanner) {
    content.push({
      id: nextId("inst_ban"),
      componentType: "banner",
      content: {
        backgroundImage: config.cta.bannerBackgroundImage,
        headline: config.cta.bannerHeadline,
        subline: config.cta.bannerSubline,
        ctaText: config.cta.bannerCTAText,
        ctaUrl: config.cta.bannerCTAUrl,
        showHeadline: config.cta.showHeadline,
        showSubline: config.cta.showSubline,
        showButton: config.cta.showButton,
      },
    });
  }

  return {
    version: 1,
    zones: {
      "column-left": columnLeft,
      "column-right": columnRight,
      content,
    },
  };
}
