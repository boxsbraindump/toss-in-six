import type { NextConfig } from "next";

// GitHub Pages 部署在 /toss-in-six 子路径下，CI 里设 NEXT_PUBLIC_BASE_PATH；本地开发为空
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  transpilePackages: ["@liuyao/core"],
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
