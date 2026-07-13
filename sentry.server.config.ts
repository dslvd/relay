import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Stays fully inert (no network calls) until SENTRY_DSN is set, so this
  // is safe to have wired in before you've created a Sentry project.
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
});
