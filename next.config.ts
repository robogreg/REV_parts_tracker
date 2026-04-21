import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/frc-events\.firstinspires\.org\/v2\.0\//,
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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.bigcommerce.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  serverExternalPackages: ['firebase-admin'],
};

module.exports = withPWA(nextConfig);
