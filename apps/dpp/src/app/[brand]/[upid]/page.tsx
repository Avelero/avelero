import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockProducts } from '@/lib/mock-data/products';
import { mockThemeConfigs } from '@/lib/mock-data/theme-config';
import { mockThemeStyles } from '@/lib/mock-data/theme-styles';
import { generateThemeCSS } from '@/lib/theme/css-generator';
import { generateGoogleFontsUrlFromTypography } from '@/lib/theme/google-fonts';
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
  const themeConfig = mockThemeConfigs[brand];
  
  // Return default metadata if data doesn't exist
  if (!productData || !themeConfig) {
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
  
  // Get separated mock data
  const productData = mockProducts[upid];
  const themeConfig = mockThemeConfigs[brand];
  const themeStyles = mockThemeStyles[brand]; // Optional - can be undefined
  
  // Return 404 if mock data doesn't exist
  if (!productData || !themeConfig) {
    notFound();
  }
  
  // Generate CSS variables from theme styles
  const cssVars = generateThemeCSS(themeStyles);
  
  // Generate Google Fonts URL from typography
  const googleFontsUrl = themeStyles?.typography
    ? generateGoogleFontsUrlFromTypography(themeStyles.typography)
    : '';
  
  return (
    <>
      {/* Theme injection - CSS variables and Google Fonts */}
      <ThemeInjector cssVars={cssVars} googleFontsUrl={googleFontsUrl} />
      
      <div className="min-h-screen flex flex-col">
        {/* Header with spacer for fixed positioning */}
        <div style={{ height: 'var(--header-height)' }} />
        <Header themeConfig={themeConfig} brandName={productData.brandName} />
        
        {/* Main content */}
        <ContentFrame data={productData} themeConfig={themeConfig} />
        
        {/* Footer */}
        <Footer themeConfig={themeConfig} />
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
    // MR MARVIS
    { brand: 'mrmarvis', upid: 'MRM001' },
    { brand: 'mrmarvis', upid: 'MRM002' },
    { brand: 'mrmarvis', upid: 'MRM003' },
    // Filling Pieces
    { brand: 'fillingpieces', upid: 'FP001' },
    { brand: 'fillingpieces', upid: 'FP002' },
    { brand: 'fillingpieces', upid: 'FP003' },
  ];
}