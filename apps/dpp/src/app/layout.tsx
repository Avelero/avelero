import type { Metadata, Viewport } from "next";
import "@v1/dpp-components/globals.css";

export const metadata: Metadata = {
  title: "Digital Product Passport",
  description: "View product sustainability information and supply chain data",
  icons: {
    // Root fallback so legacy agents and default requests succeed
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts: Geist Sans and Geist Mono as default fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&family=Geist+Mono:wght@100;200;300;400;500;600;700;800;900&display=swap"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
