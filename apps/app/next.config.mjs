import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@v1/supabase", "@v1/selections", "@v1/ui", "@v1/utils"],
  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
        pathname: "/storage/**", // allow both public and sign URLs
      },
    ],
  },
  
  experimental: {
    // Cache Components: Major performance win for static & dynamic content
    // cacheComponents: true, // Enable when ready - requires "use cache" directives
    
    // React Compiler: Automatic optimization (experimental)
    // reactCompiler: true, // Enable for automatic memoization
    
    // Optimize imports: Reduces bundle size
    optimizePackageImports: ['@v1/ui', 'lucide-react', '@tanstack/react-table'],
    
    // Prefetch tuning: Control staleness
    staleTimes: {
      dynamic: 30,  // Keep dynamic pages fresh for 30s
      static: 180,  // Keep static pages fresh for 3min
    },
  },
  
  // Logging for better debugging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
