import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);

const isLocal =
  supabaseUrl.hostname === "127.0.0.1" || supabaseUrl.hostname === "localhost";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@v1/supabase", "@v1/ui"],
  cacheComponents: true,
  images: {
    unoptimized: isLocal,
    remotePatterns: [
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
