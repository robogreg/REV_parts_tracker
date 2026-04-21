import type { NextConfig } from 'next';
import type { Configuration, ExternalItemFunctionData } from 'webpack';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.bigcommerce.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  // Tell Next.js not to bundle firebase-admin (and all its sub-paths) in the
  // server bundle — it must be required at runtime from node_modules.
  serverExternalPackages: [
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/auth',
    'firebase-admin/firestore',
    '@google-cloud/firestore',
    'google-auth-library',
  ],
  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Belt-and-suspenders: also mark firebase-admin as a webpack external
      // so no worker ever tries to parse its native binaries.
      const prev = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : [];
      config.externals = [
        ...prev,
        (data: ExternalItemFunctionData, callback: (err?: Error | null, result?: string) => void) => {
          const { request } = data;
          if (request && request.startsWith('firebase-admin')) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

// Only apply next-pwa in production — it injects a webpack config that
// conflicts with Turbopack (the Next.js 16 default for dev).
if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/frc-api\.firstinspires\.org\/v2\.0\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'first-api-cache',
          networkTimeoutSeconds: 10,
          expiration: { maxAgeSeconds: 3600, maxEntries: 50 },
        },
      },
      {
        urlPattern: /^https:\/\/ftc-events\.firstinspires\.org\/v2\.0\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'first-ftc-api-cache',
          networkTimeoutSeconds: 10,
          expiration: { maxAgeSeconds: 3600, maxEntries: 50 },
        },
      },
      {
        urlPattern: /\/api\/events$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'events-cache',
          networkTimeoutSeconds: 5,
          expiration: { maxAgeSeconds: 1800, maxEntries: 10 },
        },
      },
      {
        urlPattern: /\/api\/events\/[^/]+\/inventory/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'inventory-cache',
          networkTimeoutSeconds: 5,
          expiration: { maxAgeSeconds: 1800, maxEntries: 20 },
        },
      },
      {
        urlPattern: /\.(?:js|css|woff2?)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxAgeSeconds: 86400, maxEntries: 100 },
        },
      },
    ],
  });
  module.exports = withPWA(nextConfig);
} else {
  module.exports = nextConfig;
}
