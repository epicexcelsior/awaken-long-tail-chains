import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
  // Disable server-side features since we're doing static export
  trailingSlash: true,
};

export default nextConfig;
