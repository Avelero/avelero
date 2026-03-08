/**
 * Root layout for the dashboard app shell.
 */

import "@v1/ui/globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "@v1/ui/sonner";
import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { ThemeProvider } from "next-themes";

const APP_SHELL_FONT_VARS = {
  "--font-geist-sans":
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--font-geist-mono":
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: "Avelero",
  description:
    "Create engaging digital product passports for your fashion brand. Upload any data format and launch your DPPs in minutes, not days.",
  icons: {
    // Root fallback so legacy agents and default requests succeed.
    icon: [
      { url: "/favicon.ico" },

      // Themed ICO
      {
        url: "/favicon/FaviconDark.ico",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon/FaviconLight.ico",
        media: "(prefers-color-scheme: dark)",
      },

      // Themed PNG sizes
      {
        url: "/favicon/FaviconDark32.png",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon/FaviconLight32.png",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon/FaviconDark16.png",
        type: "image/png",
        sizes: "16x16",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon/FaviconLight16.png",
        type: "image/png",
        sizes: "16x16",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [
      {
        url: "/favicon/AppleTouchIconDark.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon/AppleTouchIconLight.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/favicon/MaskIconDark.svg",
        color: "#020212",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "mask-icon",
        url: "/favicon/MaskIconLight.svg",
        color: "#FAFAFF",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#020212" },
    { media: "(prefers-color-scheme: dark)", color: "#FAFAFF" },
  ],
};

/**
 * Provides the dashboard shell with a stable system font stack.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
        style={APP_SHELL_FONT_VARS}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            <div className="h-screen w-screen">{children}</div>
            <Toaster />
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
