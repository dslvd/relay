# Relay - File Sharing Platform

A modern, secure file sharing platform built with Next.js 15 and Vercel Blob storage.

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
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
ADMIN_PASSWORD=your_admin_password
CRON_SECRET=generate_with_openssl_rand_base64_32
REDIS_URL=redis://default:password@host:port
PREMIUM_INVITE_SECRET=your_long_random_secret
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
   - `BLOB_READ_WRITE_TOKEN` (from Vercel Blob store)
   - `ADMIN_PASSWORD` (your admin password)
   - `CRON_SECRET` (generate with `openssl rand -base64 32`)
4. Deploy!

**Note**: Cron jobs require Vercel Pro plan. Hobby plan can use manual cleanup endpoint.

### Environment Variables Setup

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Yes |
| `ADMIN_PASSWORD` | Admin dashboard password | Yes |
| `CRON_SECRET` | Secret for cron authentication | Yes (for auto-cleanup) |
| `REDIS_URL` | Redis connection URL (premium auth persistence) | Yes (for reliable premium auth) |
| `PREMIUM_INVITE_SECRET` | HMAC secret for premium invite tokens | Yes (premium invites) |
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
- **Storage**: Vercel Blob
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