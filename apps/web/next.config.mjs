/** @type {import('next').NextConfig} */
const nextConfig = {
    poweredByHeader: false,
    reactStrictMode: true,
    trailingSlash: true,
    transpilePackages: ["@v1/ui"],
    
    images: {
        qualities: [75, 85, 90, 100],
        // Default cache is now 4 hours (up from 60s in v15)
        minimumCacheTTL: 14400,
    },
    
    experimental: {
        // Keep inlineCss for marketing site
        inlineCss: true,
        
        // Cache Components: Perfect for marketing pages
        // cacheComponents: true, // Enable when ready
        
        // React Compiler: Great for marketing site
        // reactCompiler: true, // Enable for automatic optimization
        
        // Optimize imports
        optimizePackageImports: ['@v1/ui', 'lucide-react'],
        
        // Aggressive caching for marketing site
        staleTimes: {
            dynamic: 0,      // No dynamic pages
            static: 3600,    // Keep static pages fresh for 1 hour
        },
    },
    
    // Logging
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
};

export default nextConfig;
