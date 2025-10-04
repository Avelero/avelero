export const MODULE_KEYS = [
  "core",
  "environment",
  "materials",
  "journey",
  "carousel",
  "cta_banner",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

// Maps mutation identifiers to the module keys they affect.
// Routers/queries will reference these to decide which modules to recompute.
export const MUTATION_TO_MODULES: Record<string, ModuleKey[]> = {
  "product.core.updated": ["core"],
  "variant.updated": ["core"],
  "materials.upserted": ["materials"],
  "environment.upserted": ["environment"],
  "journey.set": ["journey"],

  // Template-level changes; actual execution will filter via delta (added/removed)
  "template.modules.added": [
    "core",
    "environment",
    "materials",
    "journey",
    "carousel",
    "cta_banner",
  ],
  "template.modules.removed": [
    "core",
    "environment",
    "materials",
    "journey",
    "carousel",
    "cta_banner",
  ],

  // Template reassignment; actual execution uses set difference to avoid full recompute
  "passport.template.reassigned": [
    "core",
    "environment",
    "materials",
    "journey",
    "carousel",
    "cta_banner",
  ],
};
