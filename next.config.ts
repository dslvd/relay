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
  async headers() {
    return [
      {
        // Applies to every route - no CSP here: this app loads several
        // third-party scripts (Lordicon, Clicky, Sentry) and a locking down
        // script-src without testing each one live risks silently breaking
        // them, so that's left as a follow-up rather than shipped blind.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
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
