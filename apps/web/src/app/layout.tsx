import "@/styles/globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { cn } from "@v1/ui/cn";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { CTABlock } from "@/components/cta-block";

const Switzer = localFont({
  src: "../fonts/Switzer-Regular.woff2",
  variable: "--font-switzer",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://avelero.app"),
  title: "Avelero",
  description:
    "Avelero is built for fashion brands that want to launch compliant product passports in days, not months. Integrate your systems, estimate product footprints, and design on-brand experiences that customers want to explore.",
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          `${Switzer.variable} ${GeistSans.variable} ${GeistMono.variable}`,
          "font-sans antialiased",
          "bg-background text-foreground",
          "h-screen w-full",
          "overflow-y-auto overflow-x-hidden",
        )}
      >
        <div className="max-w-[1280px] min-h-full xl:mx-auto xl:border-x xl:border-border">
          <div className="h-full flex flex-col">
            <Header />
            <div className="px-6 sm:px-16 flex-1">
              {children}
              <CTABlock />
            </div>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
