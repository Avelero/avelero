/**
 * Demo passport configuration for the public DPP demo.
 *
 * Uses the dedicated demo passport with realistic mock content, distinct from
 * the bare default passport used when creating new brands.
 */

import { createDemoPassport } from "@v1/dpp-components";

export const demoPassport = createDemoPassport();
