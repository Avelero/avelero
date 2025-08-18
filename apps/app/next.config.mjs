import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@v1/supabase", "@v1/location", "@v1/ui", "@v1/utils"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;