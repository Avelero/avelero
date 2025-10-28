import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockProducts } from '@/lib/mock-data/products';
import { mockThemes } from '@/lib/mock-data/themes';
// Theme system temporarily disabled during component-classes refactor
// import { generateCSSVariables } from '@/lib/theme/css-vars';
// import {
//   extractGoogleFontsFromTypography,
//   generateGoogleFontsUrl,
//   generateFallbackGoogleFontsUrl,
//   fetchMultipleFontMetadata,
// } from '@/lib/theme/google-fonts';
// import { ThemeInjector } from '@/components/theme/theme-injector';
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
  
  // Theme injection disabled: do not generate CSS variables or load Google Fonts
  
  return (
    <>
      <div className="min-h-screen flex flex-col">
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
    { brand: 'fillingpieces', upid: 'FP001' },
    { brand: 'fillingpieces', upid: 'FP002' },
    { brand: 'fillingpieces', upid: 'FP003' },
  ];
}
