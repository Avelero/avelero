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
  // Performance optimizations for dev mode
  typescript: {
    ignoreBuildErrors: true, // Skip type checking in dev (use typecheck script separately)
  },
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint in dev (use lint script separately)
  },
};

export default nextConfig;
