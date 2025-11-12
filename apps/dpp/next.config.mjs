/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    domains: ["images.unsplash.com", "res.cloudinary.com"],
  },
  experimental: {
    typedRoutes: true,
  },
  // Performance optimizations for dev mode
  typescript: {
    ignoreBuildErrors: true, // Skip type checking in dev (use typecheck script separately)
  },
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint in dev (use lint script separately)
  },
};

export default nextConfig;
