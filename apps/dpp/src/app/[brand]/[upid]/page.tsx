import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { demoThemeConfig } from '@/demo-data/config';
import { generateThemeCSS, generateFontFaceCSS } from '@/lib/theme/css-generator';
import { generateGoogleFontsUrlFromTypography } from '@/lib/theme/google-fonts';
import { ThemeInjector } from '@/components/theme/theme-injector';
import { Header } from '@/components/layout/header';
import { ContentFrame } from '@/components/layout/content-frame';
import { Footer } from '@/components/layout/footer';
import { createClient } from '@v1/supabase/server';
import { getPublicUrl } from '@v1/supabase/utils/storage-urls';
import type { DppData, ThemeConfig, ThemeStyles } from '@v1/dpp-components';

interface PageProps {
  params: Promise<{
    brand: string;
    upid: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { upid } = await params;
  const supabase = await createClient();

  const { data: variant } = await supabase
    .from('product_variants')
    .select('product_id')
    .eq('upid', upid)
    .maybeSingle();

  if (!variant) {
    return {
      title: 'Digital Product Passport',
      description: 'View product sustainability information and supply chain data',
    };
  }

  const { data: product } = await supabase
    .from('products')
    .select('name, description, brand_id')
    .eq('id', variant.product_id)
    .maybeSingle();

  if (!product) {
    return {
      title: 'Digital Product Passport',
      description: 'View product sustainability information and supply chain data',
    };
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .eq('id', product.brand_id)
    .maybeSingle();

  return {
    title: `${brand?.name ?? 'Digital Product Passport'} | ${product.name ?? 'Product'}`,
    description: product.description ?? 'View product sustainability information and supply chain data',
  };
}

export default async function DPPPage({ params }: PageProps) {
  const { upid } = await params;
  const supabase = await createClient();

  // Lookup variant by UPID
  const { data: variant, error: variantError } = await supabase
    .from('product_variants')
    .select('id, product_id')
    .eq('upid', upid)
    .maybeSingle();

  if (!variant || variantError) {
    notFound();
  }

  // Fetch product and brand
  const { data: product } = await supabase
    .from('products')
    .select('id, brand_id, name, description, primary_image_url, product_identifier')
    .eq('id', variant.product_id)
    .maybeSingle();

  if (!product) {
    notFound();
  }

  const { data: brandRow } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', product.brand_id)
    .maybeSingle();

  const brandName = brandRow?.name ?? 'Brand';

  // Fetch theme for the product's brand
  const { data: brandTheme } = await supabase
    .from('brand_theme')
    .select('theme_config, theme_styles, stylesheet_path, google_fonts_url')
    .eq('brand_id', product.brand_id)
    .maybeSingle();

  const themeConfig: ThemeConfig = (brandTheme?.theme_config as ThemeConfig) ?? demoThemeConfig;
  const themeStyles: ThemeStyles | undefined = brandTheme?.theme_styles as ThemeStyles | undefined;

  // Build DPP data from DB (use empty strings/arrays for optional fields)
  const productData: DppData = {
    title: product.name ?? 'Product',
    brandName,
    productImage: product.primary_image_url ?? '',
    description: product.description ?? '',
    size: '',
    color: '',
    category: '',
    articleNumber: product.product_identifier ?? '',
    manufacturer: '',
    countryOfOrigin: '',
    materials: [],
    journey: [],
    impactMetrics: [],
    impactClaims: [],
    similarProducts: [],
  };

  // Prefer stored stylesheet; only generate inline CSS if none is available
  const cssVars = brandTheme?.stylesheet_path ? '' : generateThemeCSS(themeStyles);

  // Google Fonts: prefer stored URL, otherwise derive from theme styles
  const googleFontsUrl =
    brandTheme?.google_fonts_url ||
    (themeStyles?.typography
      ? generateGoogleFontsUrlFromTypography(themeStyles.typography)
      : '');

  // Generate @font-face CSS from custom fonts when present
  const fontFaceCSS = generateFontFaceCSS(themeStyles?.customFonts);

  // Resolve Supabase public stylesheet URL if provided
  const publicStylesheetUrl =
    brandTheme?.stylesheet_path && getPublicUrl(supabase, 'dpp-themes', brandTheme.stylesheet_path);
  
  return (
    <>
      {/* Theme injection - CSS variables, Google Fonts, and custom fonts */}
      <ThemeInjector 
        cssVars={cssVars} 
        googleFontsUrl={googleFontsUrl}
        fontFaceCSS={fontFaceCSS}
      />
      
      {/* Supabase-hosted stylesheet overrides (if available) */}
      {publicStylesheetUrl && (
        <link rel="stylesheet" href={publicStylesheetUrl} />
      )}
      
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

// No static params – dynamic routes rely on DB lookups
