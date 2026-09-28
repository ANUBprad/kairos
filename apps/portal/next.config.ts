import path from "path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://vitals.vercel-insights.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
];

if (isProduction) {
  CSP_DIRECTIVES.push(
    "frame-src 'self' https://posthog.app",
    "worker-src 'self' blob:",
  );
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), browsing-topics=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(self), gamepad=(), layout-animations=(self), legacy-image-formats=(), midi=(), navigation-override=(), oversized-images=(self), picture-in-picture=(self), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(self), web-share=(), xr-spatial-tracking=()" },
  ...(isProduction
    ? [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Content-Security-Policy", value: CSP_DIRECTIVES.join("; ") },
      ]
    : []),
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 300,
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
    {
      source: "/api/(.*)",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
      ],
    },
  ],
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      'framer-motion',
      '@hookform/resolvers',
      'zod',
    ],
  },
  output: 'standalone',
};

export default nextConfig;
