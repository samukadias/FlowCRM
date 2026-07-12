import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necessário para o build Docker (Dockerfile usa .next/standalone)
  output: "standalone",
};

export default nextConfig;
