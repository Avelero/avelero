import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-switzer)",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        h1: [
          "8.000rem",
          {
            lineHeight: "0.9",
            letterSpacing: "-0.02em",
          },
        ],
        h2: [
          "5.625rem",
          {
            lineHeight: "1",
            letterSpacing: "-0.01em",
          },
        ],
        h3: [
          "4rem",
          {
            lineHeight: "1.1",
            letterSpacing: "-0.01em",
          },
        ],
        h4: [
          "2.812rem",
          {
            lineHeight: "1.2",
            letterSpacing: "0",
          },
        ],
        h5: [
          "2rem",
          {
            lineHeight: "1.3",
            letterSpacing: "0",
          },
        ],
        h6: [
          "1.438rem",
          {
            lineHeight: "1.4",
            letterSpacing: "0",
          },
        ],
        body: [
          "1rem",
          {
            lineHeight: "1.5",
            letterSpacing: "0",
          },
        ],
        small: [
          "0.875rem",
          {
            lineHeight: "1.5",
            letterSpacing: "0",
          },
        ],
        button: [
          "0.875rem",
          {
            lineHeight: "1",
            letterSpacing: "0",
          },
        ],
        micro: [
          "0.75rem",
          {
            lineHeight: "1.5",
            letterSpacing: "0",
          },
        ],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        ring: "var(--ring)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/container-queries"),
  ],
} satisfies Config;
