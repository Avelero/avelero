import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@v1/supabase",
    "@v1/selections",
    "@v1/ui",
    "@v1/utils",
    "@v1/dpp-components",
  ],
  cacheComponents: true,
  serverExternalPackages: ["pino", "thread-stream"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
        pathname: "/storage/**", // allow both public and sign URLs
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
