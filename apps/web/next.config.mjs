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
    // Local marketing images in this app top out around 2304px wide.
    // Capping generated device widths avoids wasteful 3840px variants.
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1600, 1920, 2048, 2304],
    qualities: [75, 85, 90, 100],
  },
};

export default nextConfig;
