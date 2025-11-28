import baseConfig from "@v1/ui/tailwind.config";
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/dpp-components/src/**/*.{ts,tsx}",
  ],
  presets: [baseConfig],
} satisfies Config;
