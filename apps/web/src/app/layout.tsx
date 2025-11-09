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
  src: "../../public/fonts/Switzer-Regular.woff2",
  variable: "--font-switzer",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://avelero.com"),
  title: {
    default: "Avelero | Product passports that engage",
    template: "Avelero | %s",
  },
  description:
    "Avelero is built for fashion brands that want to launch EU-compliant product passports in days, not months.",
  openGraph: {
    title: "Avelero | Product passports that engage",
    description:
      "Avelero is built for fashion brands that want to launch EU-compliant product passports in days, not months.",
    url: "https://avelero.com",
    siteName: "Avelero",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://avelero.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Avelero - Product passports that engage",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Avelero | Product passports that engage",
    description:
      "Avelero is built for fashion brands that want to launch EU-compliant product passports in days, not months.",
    images: ["https://avelero.com/og-image.jpg"],
    creator: "@avelerodpp",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Avelero",
    url: "https://avelero.com",
    description:
      "Avelero helps fashion brands launch EU-compliant digital product passports with our product footprint LCA engine, API-integrations, and customizable templates.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "raf@avelero.com",
      contactType: "Customer Service",
    },
    sameAs: [
      "https://www.linkedin.com/company/avelero",
      "https://x.com/avelerodpp",
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/Switzer-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
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
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
