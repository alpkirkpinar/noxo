import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.10", "192.168.1.17", "192.168.2.4"],
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  reactCompiler: true,
};

export default nextConfig;
