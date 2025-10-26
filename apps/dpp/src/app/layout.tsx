import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Digital Product Passport',
  description: 'View product sustainability information and supply chain data',
  icons: {
    // Root fallback so legacy agents and default requests succeed
    icon: [
      { url: '/favicon.ico' },

      // Themed ICO
      {
        url: '/favicon/FaviconDark.ico',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/favicon/FaviconLight.ico',
        media: '(prefers-color-scheme: dark)',
      },

      // Themed PNG sizes
      {
        url: '/favicon/FaviconDark32.png',
        type: 'image/png',
        sizes: '32x32',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/favicon/FaviconLight32.png',
        type: 'image/png',
        sizes: '32x32',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/favicon/FaviconDark16.png',
        type: 'image/png',
        sizes: '16x16',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/favicon/FaviconLight16.png',
        type: 'image/png',
        sizes: '16x16',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: [
      {
        url: '/favicon/AppleTouchIconDark.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/favicon/AppleTouchIconLight.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon/MaskIconDark.svg',
        color: '#020212',
        media: '(prefers-color-scheme: light)',
      },
      {
        rel: 'mask-icon',
        url: '/favicon/MaskIconLight.svg',
        color: '#FAFAFF',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#020212' },
    { media: '(prefers-color-scheme: dark)', color: '#FAFAFF' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-background text-primary-text" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}


