import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockProducts } from '@/lib/mock-data/products';
import { mockThemes } from '@/lib/mock-data/themes';
import { generateCSSVariables } from '@/lib/theme/css-vars';
import { extractGoogleFontsFromTypography, generateGoogleFontsUrl } from '@/lib/theme/google-fonts';
import { ThemeInjector } from '@/components/theme/theme-injector';
import { Header } from '@/components/layout/header';
import { ContentFrame } from '@/components/layout/content-frame';
import { Footer } from '@/components/layout/footer';

interface PageProps {
  params: Promise<{
    brand: string;
    upid: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brand, upid } = await params;
  
  // Get mock data
  const productData = mockProducts[upid];
  const themeData = mockThemes[brand];
  
  // Return default metadata if data doesn't exist
  if (!productData || !themeData) {
    return {
      title: 'Digital Product Passport',
      description: 'View product sustainability information and supply chain data',
    };
  }
  
  return {
    title: `${productData.brandName} | ${productData.title}`,
    description: productData.description,
  };
}

export default async function DPPPage({ params }: PageProps) {
  const { brand, upid } = await params;
  
  // Get mock data
  const productData = mockProducts[upid];
  const themeData = mockThemes[brand];
  
  // Return 404 if mock data doesn't exist
  if (!productData || !themeData) {
    notFound();
  }
  
  // Generate CSS variables from theme
  const cssVars = generateCSSVariables(themeData);
  
  // Generate Google Fonts URL if needed
  const googleFonts = extractGoogleFontsFromTypography(themeData.typography);
  const googleFontsUrl = googleFonts.length > 0 ? generateGoogleFontsUrl(googleFonts) : undefined;
  
  return (
    <>
      <ThemeInjector cssVars={cssVars} googleFontsUrl={googleFontsUrl} />
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header with spacer for fixed positioning */}
        <div style={{ height: 'var(--header-height)' }} />
        <Header theme={themeData} brandName={productData.brandName} />
        
        {/* Main content */}
        <ContentFrame data={productData} theme={themeData} />
        
        {/* Footer */}
        <Footer theme={themeData} />
      </div>
    </>
  );
}

// Generate static params for mock data
export function generateStaticParams() {
  return [
    // Acme Studios
    { brand: 'acme', upid: 'ABC123' },
    { brand: 'acme', upid: 'DEF456' },
    { brand: 'acme', upid: 'GHI789' },
    // Verde Collective
    { brand: 'mrmarvis', upid: 'MRM001' },
    { brand: 'mrmarvis', upid: 'MRM002' },
    { brand: 'mrmarvis', upid: 'MRM003' },
    // Luxora Fashion
    { brand: 'luxora', upid: 'LXR001' },
    { brand: 'luxora', upid: 'LXR002' },
    { brand: 'luxora', upid: 'LXR003' },
  ];
}
