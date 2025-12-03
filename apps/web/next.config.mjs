/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: ["@v1/ui"],
  experimental: {
    inlineCss: true,
  },
  images: {
    qualities: [75, 85, 90, 100],
  },
};

export default nextConfig;
