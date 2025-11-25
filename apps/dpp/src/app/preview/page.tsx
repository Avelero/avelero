'use client';

import { useState, useEffect } from 'react';
import type { ThemeConfig } from '@/types/theme-config';
import { demoThemeConfig } from '@/demo-data/config';
import { demoProductData } from '@/demo-data/data';
import { generateThemeCSS } from '@/lib/theme/css-generator';
import { ThemeInjector } from '@/components/theme/theme-injector';
import { Header } from '@/components/layout/header';
import { ContentFrame } from '@/components/layout/content-frame';
import { Footer } from '@/components/layout/footer';

// Message protocol for postMessage communication
export interface PreviewMessage {
    type: 'THEME_CONFIG_UPDATE';
    payload: ThemeConfig;
}

// Allowed origins for security
const ALLOWED_ORIGINS = [
    'http://localhost:3000',           // Development
    'https://app.avelero.com',         // Production (update with your actual domain)
    process.env.NEXT_PUBLIC_APP_URL,   // From env
].filter(Boolean) as string[];

export default function PreviewPage() {
    const [config, setConfig] = useState<ThemeConfig>(demoThemeConfig);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const handleMessage = (event: MessageEvent<PreviewMessage>) => {
            // Security: Validate origin
            if (!ALLOWED_ORIGINS.includes(event.origin)) {
                console.warn('[DPP Preview] Rejected message from unauthorized origin:', event.origin);
                return;
            }

            // Handle config updates
            if (event.data?.type === 'THEME_CONFIG_UPDATE') {
                console.log('[DPP Preview] Received config update:', event.data.payload);
                setConfig(event.data.payload);
                setIsConnected(true);
            }
        };

        window.addEventListener('message', handleMessage);

        // Notify parent that we're ready
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');
        }

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Generate CSS variables from theme config
    const cssVars = generateThemeCSS(undefined);

    return (
        <>
            <ThemeInjector cssVars={cssVars} googleFontsUrl="" />
            <div className="min-h-screen flex flex-col">
                <div style={{ height: 'var(--header-height)' }} />
                <Header
                    themeConfig={config}
                    brandName={demoProductData.brandName}
                />
                <ContentFrame
                    data={demoProductData}
                    themeConfig={config}
                />
                <Footer themeConfig={config} />
            </div>
        </>
    );
}
