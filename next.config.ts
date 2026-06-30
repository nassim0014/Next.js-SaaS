import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
    ],
  },
  // Allow specific domains for Supabase Storage + avatar uploads
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Strip sensitive env vars from the client bundle
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "Next.js SaaS",
  },
  // Headers for security hardening
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking — no framing at all
          { key: "X-Frame-Options", value: "DENY" },
          // MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer leakage — only send origin, not full URL
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Lock down browser APIs we don't use
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // HSTS — 2 years + preload + includeSubDomains
          // Even behind Cloudflare, this is defense-in-depth for when the app
          // is deployed on Vercel or other hosts without managed HSTS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Content-Security-Policy — strict for a SaaS app with AI chat.
          // 'unsafe-inline' + 'unsafe-eval' needed for Next.js dev mode;
          // in production, Next.js uses nonces/hashes so we can tighten this.
          // TODO: for production, replace 'unsafe-inline' with nonce-based CSP
          //   via next.config.ts experimental: { nonce: true } + middleware.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js needs inline styles + scripts
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Images: allow data: URIs + the remote patterns configured above
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              // API + Supabase + LLM providers
              "connect-src 'self' https://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.groq.com",
              // No frames, no plugins, no form submissions to external sites
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          // CORP/COEP/COOP — cross-origin isolation (Spectre defense)
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          // DNS prefetch — disable to prevent information leakage
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
