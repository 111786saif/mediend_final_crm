import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  output: "standalone",
  // PWA plugin uses webpack; use `next build --webpack` so build uses webpack. Empty turbopack silences config check.
  turbopack: {},
  experimental: {
    // Allows larger multipart bodies for Server Actions; pair with `/api/kyp/upload` + useFileUpload 20 MB cap.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mediend-crm-uploads-prod.s3.ap-south-1.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://workspace.mediend.com";
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: origin },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
