// Single source of truth for free/Plus limits and pricing - shared by client
// code (app/page.tsx, app/pricing/page.tsx) and server routes so the numbers
// can't drift out of sync with each other the way the old per-route
// FREE_MAX_FILE_BYTES/PLUS_MAX_FILE_BYTES constants did.

export const FREE_MAX_FILE_BYTES = 1 * 1024 * 1024 * 1024; // 1GB
export const PLUS_MAX_FILE_BYTES = 8 * 1024 * 1024 * 1024; // 8GB
export const FREE_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB total per IP
export const PLUS_STORAGE_LIMIT_BYTES = 80 * 1024 * 1024 * 1024; // 80GB total per account
// Display only - the actual charge comes from LEMONSQUEEZY_VARIANT_ID's price
// in the Lemon Squeezy dashboard (there's no API to set/read it dynamically).
// Keep this in sync with that variant's configured price.
export const PLUS_PRICE_PHP_CENTAVOS = 38900; // PHP 389.00/month

// Kill switch for the Lemon Squeezy checkout flow - flip to true once the
// store is out of Test Mode and production env vars/migration are in place.
// Checked both in the UI (app/pricing/page.tsx) and server-side
// (app/api/lemonsqueezy/checkout/route.ts) so a direct API call can't bypass it.
export const PLUS_CHECKOUT_ENABLED = false;
export const PLUS_CHECKOUT_CONTACT_EMAIL = 'matthew@xstlo.com';

// Developer API keys (app/api/dev/keys, app/api/page.tsx). "Free" here means
// no plus_auth session - those keys are scoped by IP address (see
// resolveApiKeyAccount in app/lib/auth/api-key-account.ts), same identity
// model the rest of the free tier already uses for storage/upload quotas.
export const FREE_MAX_API_KEYS = 2;
export const PLUS_MAX_API_KEYS = 30;

// Ceiling a key's own `rateLimit.requestsPerHour` can be set to (at creation
// or update) and the absolute cap enforced at request time regardless of
// what's stored - closes both the "self-report an absurd limit" hole and
// protects any key whose stored value predates these ceilings.
export const FREE_API_MAX_REQUESTS_PER_HOUR = 500;
export const PLUS_API_MAX_REQUESTS_PER_HOUR = 5000;

// Total storage across ALL of a free account's API keys combined (shared
// pool, not per-key) - separate from FREE_STORAGE_LIMIT_BYTES, which covers
// that same IP's anonymous website uploads.
export const FREE_API_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
// Plus API uploads share PLUS_STORAGE_LIMIT_BYTES with the account's regular
// web-upload vault (one 80GB pool, not a separate one) - see the Plus
// dashboard's "API Uploads" folder, populated by the same upload routes.
// Per-upload size caps for API uploads reuse FREE_MAX_FILE_BYTES /
// PLUS_MAX_FILE_BYTES directly (1GB / 8GB) - same ceiling as the website.
