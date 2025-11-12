/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  images: {
    // FIXED: Migrated from deprecated 'domains' to 'remotePatterns'
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  
  // FIXED: Moved from experimental to top-level
  typedRoutes: true,
  
  experimental: {
    // Cache Components: Great for public-facing DPP pages
    // cacheComponents: true, // Enable when ready
    
    // Optimize imports
    optimizePackageImports: ['@v1/ui', '@v1/selections'],
    
    // Aggressive caching for public DPP pages
    staleTimes: {
      dynamic: 0,    // DPP pages are static
      static: 300,   // Keep cached for 5min
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


