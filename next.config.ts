import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Same-origin proxy to the FastAPI backend: the browser only ever talks
  // to this Next.js origin, so the httpOnly session cookie (see
  // app/auth/session/route.ts) rides along automatically on every /api/*
  // request — no CORS, no client-side token handling. Verified to pass
  // through Server-Sent Event streaming (the /api/chat endpoint) without
  // buffering.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
};

export default nextConfig;

