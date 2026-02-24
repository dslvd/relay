# Redis Setup for Premium Auth

This application uses Redis for persistent storage of premium user accounts, sessions, and invite links.

## Configuration

The premium auth system has been migrated from Vercel KV to direct Redis client support to use your existing Redis Cloud instance.

### Environment Variable

Add the following to your `.env.local` file:

```env
REDIS_URL=redis://default:password@host:port
```

For Redis Cloud instances, the URL format will be:
```
redis://default:{password}@{host}:{port}
```

Example (placeholder values only):
```env
REDIS_URL=redis://default:your_password@your_host:your_port
```

## What Gets Stored

The following data is persisted in Redis:

- **`premium:users`** - Premium user accounts (email, password hash, salt, creation date)
- **`premium:invites`** - Admin-created invite links (with expiry times)
- **`premium:sessions`** - Active user sessions (30-day TTL)
- **`premium:used-invite-hashes`** - List of one-time-use invite tokens to prevent reuse
- **`premium:revoked-invite-ids`** - List of revoked invite IDs

## Features

✅ **Persistent Authentication** - User accounts and sessions survive across server restarts  
✅ **Admin-Managed Invites** - One-time use, time-limited signup links  
✅ **Secure Sessions** - 30-day session expiry with secure token generation  
✅ **Fallback Support** - Falls back to in-memory storage if `REDIS_URL` is not configured  

## Technology

- **Client Library**: `redis` npm package (v5.11.0+)
- **Protocol**: Redis wire protocol (RESP3)
- **Connection**: Direct TCP to Redis instance
- **Storage Type**: JSON serialization stored as Redis strings

## Security

All data in Redis is:
- Password-protected via Redis authentication
- Transmitted over TLS if using Redis Cloud
- Includes hashed passwords with salt for user accounts
- Uses HMAC-signed tokens for invite links

## Testing

To test the Redis connection:

```bash
npm run dev
```

Try:
1. Creating a premium invite link via `/admin/dashboard`
2. Registering a new premium account via `/premium` using the invite link
3. Logging in with your credentials
4. Verifying the account persists across server restarts

If `REDIS_URL` is not set, the system falls back to in-memory storage (not suitable for production).
