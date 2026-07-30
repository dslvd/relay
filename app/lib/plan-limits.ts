// Single source of truth for free/Plus limits and pricing - shared by client
// code (app/page.tsx, app/pricing/page.tsx) and server routes so the numbers
// can't drift out of sync with each other the way the old per-route
// FREE_MAX_FILE_BYTES/PLUS_MAX_FILE_BYTES constants did.

export const FREE_MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB
export const PLUS_MAX_FILE_BYTES = 8 * 1024 * 1024 * 1024; // 8GB
export const PLUS_STORAGE_LIMIT_BYTES = 80 * 1024 * 1024 * 1024; // 80GB total per account
// Display only - the actual charge comes from LEMONSQUEEZY_VARIANT_ID's price
// in the Lemon Squeezy dashboard (there's no API to set/read it dynamically).
// Keep this in sync with that variant's configured price.
export const PLUS_PRICE_PHP_CENTAVOS = 48000; // PHP 480.00/month

// Kill switch for the Lemon Squeezy checkout flow - flip to true once the
// store is out of Test Mode and production env vars/migration are in place.
// Checked both in the UI (app/pricing/page.tsx) and server-side
// (app/api/lemonsqueezy/checkout/route.ts) so a direct API call can't bypass it.
export const PLUS_CHECKOUT_ENABLED = false;
export const PLUS_CHECKOUT_CONTACT_EMAIL = 'matthew@xstlo.com';
