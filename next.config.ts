import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // {
      //   source: '/download/:path*',
      //   destination: '/d/:path*',
      //   permanent: true,
      // },
    ];
  },
};

// No-op (passes requests straight through, no source-map upload) until
// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are set - safe to leave wrapped
// even before those are configured.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
