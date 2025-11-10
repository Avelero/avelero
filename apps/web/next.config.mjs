import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Performance optimizations for dev mode
  typescript: {
    ignoreBuildErrors: true, // Skip type checking in dev (use typecheck script separately)
  },
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint in dev (use lint script separately)
  },
};

export default nextConfig;
