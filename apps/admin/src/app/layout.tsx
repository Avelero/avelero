import "@v1/ui/globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { cn } from "@v1/ui/cn";
import { Toaster } from "@v1/ui/sonner";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "Avelero Admin",
  description: "Founder admin dashboard for Avelero",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#020212" },
    { media: "(prefers-color-scheme: dark)", color: "#FAFAFF" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          `${GeistSans.variable} ${GeistMono.variable}`,
          "font-sans antialiased",
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
            <div className="h-screen w-screen">{children}</div>
            <Toaster />
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
