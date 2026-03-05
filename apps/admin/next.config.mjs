/**
 * Next.js configuration for the admin frontend.
 */
import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const storageUrl = new URL(
  process.env.NEXT_PUBLIC_STORAGE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
);

const isLocal =
  storageUrl.hostname === "127.0.0.1" || storageUrl.hostname === "localhost";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@v1/supabase", "@v1/ui"],
  cacheComponents: true,
  images: {
    unoptimized: isLocal,
    remotePatterns: [
      {
        protocol: storageUrl.protocol.replace(":", ""),
        hostname: storageUrl.hostname,
        port: storageUrl.port,
        pathname: "/storage/**",
      },
      {
        protocol: supabaseUrl.protocol.replace(":", ""),
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: "/storage/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
