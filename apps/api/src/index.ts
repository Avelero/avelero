/**
 * Bootstraps the executable API server entrypoint.
 *
 * The actual app construction lives in `server.ts` so tests and auxiliary
 * tooling can start and stop the same runtime without reimplementing setup.
 */
import { installApiServerShutdown, startApiServer } from "./server.js";

const server = await startApiServer();
installApiServerShutdown(server);
