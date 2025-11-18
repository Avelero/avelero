export * from "./client";
export * as schema from "./schema";
export * as utils from "./utils";
export { evaluateAndUpsertCompletion } from "./completion/evaluate";
export type { ModuleKey } from "./completion/module-keys";
// Re-export drizzle-orm utilities for consumers
export {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  SQL,
  type SQLWrapper,
} from "drizzle-orm";
