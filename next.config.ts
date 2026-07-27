import type { NextConfig } from 'next';
import path from 'path';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            // Auth 3D robot loads @splinetool/viewer from unpkg; scene assets from *.spline.design.
            // worker-src blob: is required for Spline WebGL workers.
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://unpkg.com https://prod.spline.design https://*.spline.design; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
  // Pin workspace root so Next doesn't pick external parent lockfile
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ['motion', '@splinetool/react-spline'],
  webpack: (config, { dev }) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
