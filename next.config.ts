import type { NextConfig } from "next";

const staticExport = process.env.NEXT_STATIC_EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  ...(basePath ? { basePath } : {}),
  /* config options here */
  images: {
    unoptimized: staticExport,
    // domains: ["r2bucket-touhou.hgjertkljw.org"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "r2bucket-touhou.hgjertkljw.org",
        port: "",
        pathname: "/**",
      },
    ],
  }
};

export default nextConfig;
