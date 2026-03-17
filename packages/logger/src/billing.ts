import { createChildLogger } from "./index.js";

/**
 * Pre-configured child logger for the billing/webhook subsystem.
 * All log entries include { module: "billing" }.
 */
export const billingLogger = createChildLogger({ module: "billing" });
