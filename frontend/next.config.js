/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
let apiOrigin = 'http://localhost:3001'
try {
  apiOrigin = new URL(apiUrl).origin
} catch {
  // If NEXT_PUBLIC_API_URL isn't a valid URL, fall back to localhost.
}

const extraConnectSrc = (process.env.CSP_CONNECT_SRC || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const connectSrcAllowList = Array.from(
  new Set(["'self'", apiOrigin, 'http://localhost:3001', ...extraConnectSrc]),
).join(' ')

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline and unsafe-eval
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src ${connectSrcAllowList}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
