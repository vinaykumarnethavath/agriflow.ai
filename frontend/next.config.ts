import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.railway.app",
        pathname: "/static/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/static/**",
      },
    ],
  },
  // TypeScript errors will block the build by default (good for production)
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
