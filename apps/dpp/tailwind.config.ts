import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      spacing: {
        micro: "var(--spacing-micro)",
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
        "2x": "var(--spacing-2x)",
        "3x": "var(--spacing-3x)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      colors: {
        primary: "var(--color-primary-text)",
        "primary-foreground": "var(--primary-foreground)",
        "primary-green": "var(--color-primary-green)",
        "secondary-green": "var(--color-secondary-green)",
        background: "var(--color-background)",
        border: "var(--color-border)",
        brand: "var(--highlight)",
      },
    },
  },
  plugins: [],
};

export default config;
