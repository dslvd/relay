# Relay - File Sharing Platform

A modern, secure file sharing platform built with Next.js 15 on Vercel and Cloudflare R2 storage.

## ✨ Features

- 📤 **Drag & Drop Upload** - Simple file uploads with progress tracking
- 🔗 **Download Pages** - Beautiful preview pages for shared files
- 👁️ **File Preview** - In-browser preview for images, videos, PDFs, and text files
- 🗑️ **Auto-Cleanup** - Files deleted 15 days after last access (download/view)
- 📊 **Upload History** - Public history with file verification
- 🛡️ **Admin Dashboard** - Manage files and view storage usage
- 💾 **Storage Limits** - 1GB daily upload limit per IP, 100 files per day
- 📋 **Copy Links** - One-click link copying
- 🎨 **Modern UI** - Clean, dark-themed interface with Open Sans

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd vercel-blob-cdn
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=your_r2_bucket_name
R2_PUBLIC_BASE_URL=https://files.your-domain.com
MAX_UPLOAD_FILE_MB=200
ADMIN_PASSWORD=your_admin_password
CRON_SECRET=generate_with_openssl_rand_base64_32
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_D1_DATABASE_ID=your_d1_database_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
REDIS_URL=redis://default:password@host:port
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PLUS_INVITE_SECRET=your_long_random_secret
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_ORG=your_sentry_org_slug
SENTRY_PROJECT=your_sentry_project_slug
SENTRY_AUTH_TOKEN=your_sentry_auth_token
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=Relay <noreply@yourdomain.com>
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
app/
├── page.tsx                      # Main uploader interface
├── layout.tsx                    # Root layout
├── globals.css                   # Global styles
├── lib/
│   └── retention.ts             # Last-access based cleanup (15 days)
├── admin/
│   ├── page.tsx                 # Admin login
│   └── dashboard/
│       └── page.tsx             # Admin dashboard
├── api/
│   ├── upload/
│   │   └── route.ts            # Upload handler
│   ├── history/
│   │   ├── route.ts            # History CRUD
│   │   └── cleanup/
│   │       └── route.ts        # Remove deleted files from history
│   ├── access/
│   │   └── route.ts            # Update last access time
│   ├── admin/
│   │   ├── route.ts            # Admin file operations
│   │   └── auth/
│   │       └── route.ts        # Cookie-based authentication
│   └── cron/
│       └── cleanup/
│           └── route.ts        # Daily auto-cleanup endpoint
├── download/
│   └── [...path]/
│       └── page.tsx            # Download page with preview
├── d/
│   └── [...path]/
│       └── route.ts            # Blob streaming proxy
└── dmca/
    └── page.tsx                # DMCA policy page
```

## 🔐 Admin Dashboard

Access at `/admin`

**Features:**
- View all uploaded files
- Delete individual files
- Clear all files at once
- Storage usage statistics
- Cookie-based authentication

## 🤖 Automatic Cleanup

Files are automatically deleted 15 days after their **last access** via:

1. **Vercel Cron Job** - Runs daily at midnight UTC (requires Pro plan)
2. **Manual trigger** - `/api/cleanup` endpoint (for development/hobby plan)
3. **On-demand** - Runs during uploads and history fetches

**How it works:**
- When a file is uploaded, a 15-day timer starts
- Each time someone **views the download page** or **downloads the file**, the timer resets to 15 days
- Files are only deleted if they haven't been accessed for 15 full days
- This keeps popular files alive indefinitely while cleaning up unused ones

## 📊 Storage & Rate Limits

- **File size**: 200MB max per upload
- **Daily quota**: 1GB per IP address
- **Daily uploads**: 100 files per IP
- **Retention**: 15 days since last access (timer resets on download/view)
- **Cache**: No-store headers for history

## 🌐 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_BASE_URL`
   - `ADMIN_PASSWORD` (your admin password)
   - `CRON_SECRET` (generate with `openssl rand -base64 32`)
4. Deploy!

**Note**: Cron jobs require Vercel Pro plan. Hobby plan can use manual cleanup endpoint.

### Environment Variables Setup

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `R2_ACCOUNT_ID` | Cloudflare account ID for R2 endpoint | Yes |
| `R2_ACCESS_KEY_ID` | R2 API access key ID | Yes |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key | Yes |
| `R2_BUCKET` | R2 bucket name for uploads | Yes |
| `R2_PUBLIC_BASE_URL` | Public R2/custom-domain base URL | Yes |
| `MAX_UPLOAD_FILE_MB` | Per-file upload size limit in MB | No (default 100) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for D1 API | Yes (download-count tracking) |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 database ID | Yes (download-count tracking) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with D1 edit permission | Yes (download-count tracking) |
| `ADMIN_PASSWORD` | Admin dashboard password | Yes |
| `CRON_SECRET` | Secret for cron authentication | Yes (for auto-cleanup) |
| `REDIS_URL` | Redis connection URL | Recommended (shared rate limiting + misc. secondary caches; without it, rate limits and those caches fall back to per-instance memory) |
| `SUPABASE_URL` | Supabase project URL | Yes (uploads/folders/Plus accounts/API keys/analytics storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, full DB access) | Yes (same as above) |
| `PLUS_INVITE_SECRET` | HMAC secret for plus invite tokens | Yes (plus invites) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry error-tracking DSN (server / client) | Optional - inert until set |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source-map upload config | Optional - only needed for readable stack traces |
| `RESEND_API_KEY` | Resend API key for sending Plus password-reset emails | Optional - without it, reset links are logged to the server console instead of emailed |
| `RESEND_FROM_EMAIL` | "From" address for password-reset emails | No (defaults to Resend's shared test sender) |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Google AdSense Publisher ID | No (for monetization) |

## 💰 Monetization (Optional)

To enable ads and earn revenue:

1. **Sign up for Google AdSense**: Visit [google.com/adsense](https://www.google.com/adsense) and create an account
2. **Get approved**: Submit your site for review (may take 1-3 days)
3. **Get your Publisher ID**: Format is `ca-pub-XXXXXXXXXXXXXXXX`
4. **Add to environment**: 
   ```bash
   NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
   ```
5. **Get Ad Slot IDs**: Create ad units in AdSense dashboard and replace the placeholder IDs in:
   - `app/page.tsx` (line with `dataAdSlot="1234567890"`)
   - `app/download/[...path]/page.tsx` (line with `dataAdSlot="9876543210"`)

**Ad Placements:**
- Main page: After uploaded files list
- Download page: Below download/preview buttons

**Note**: Ads won't show in development mode. Deploy to production to see them.

## 🛡️ Security Features

- HttpOnly cookies for admin auth
- CRON_SECRET verification for scheduled jobs
- Server-side validation on all endpoints
- Rate limiting by IP address
- No exposed credentials in client code

## 📄 License & Legal

- DMCA policy page at `/dmca`
- Contact info configurable in `app/dmca/page.tsx`
- Built for Iloilo City, Philippines

## 🔧 Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Styling**: Inline CSS with Open Sans font
- **Deployment**: Vercel
- **Automation**: Vercel Cron Jobs

## 📝 Key Files

- `vercel.json` - Cron job configuration
- `app/lib/retention.ts` - Cleanup logic
- `next.config.ts` - Next.js configuration
- `.env.example` - Environment template

## 🤝 Contributing

Feel free to open issues or submit pull requests!

---

Built with ❤️ using Next.js and Vercel