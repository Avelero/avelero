/**
 * Passport projector tasks.
 *
 * Groups the background jobs that materialize and maintain passport versions.
 */

export { passportProjector } from "./projector-job";
export { compressPassportVersions } from "./compress-versions-job";
