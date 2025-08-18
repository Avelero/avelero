import "@v1/ui/globals.css";;
import { cn } from "@v1/ui/cn";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { TRPCReactProvider } from "@/trpc/client";

export const metadata: Metadata = {
  title: "Avelero",
  description: "Create engaging digital product passports for your fashion brand. Upload any data format and launch your DPPs in minutes, not days.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)" },
    { media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ====== STANDARD BROWSERS ====== */}
        {/* Light mode favicon (dark icon) */}
        <link rel="icon" href="/favicon/FaviconDark.ico" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/FaviconDark32.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/FaviconDark16.png" media="(prefers-color-scheme: light)" />

        {/* Dark mode favicon (light icon) */}
        <link rel="icon" href="/favicon/FaviconLight.ico" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/FaviconLight32.png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/FaviconLight16.png" media="(prefers-color-scheme: dark)" />

        {/* ====== APPLE TOUCH ICONS ====== */}
        <link rel="apple-touch-icon" href="/favicon/AppleTouchIconDark.png" media="(prefers-color-scheme: light)" />
        <link rel="apple-touch-icon" href="/favicon/AppleTouchIconLight.png" media="(prefers-color-scheme: dark)" />

        {/* ====== SAFARI PINNED TABS ====== */}
        <link rel="mask-icon" href="/favicon/MaskIconDark.svg" color="#000000" media="(prefers-color-scheme: light)" />
        <link rel="mask-icon" href="/favicon/MaskIconLight.svg" color="#ffffff" media="(prefers-color-scheme: dark)" />

        {/* ====== FALLBACK (OLD BROWSERS) ====== */}
        <link rel="icon" href="/favicon/FaviconDark.ico" />
      </head>
      <body
        className={cn(
          `${GeistSans.variable} ${GeistMono.variable}`,
          "antialiased",
        )}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            <div className="h-screen w-screen">
              {children}
            </div>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
