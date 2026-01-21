import type { z } from "zod";
import { voidSchema } from "./_shared/patterns.js";

/**
 * Input schema for summary.productStatus.
 *
 * Currently no input is required because the active brand context is enforced
 * via middleware. Placeholder schema exists for future extension.
 */
export const summaryProductStatusSchema = voidSchema;

type SummaryProductStatusInput = z.infer<typeof summaryProductStatusSchema>;
