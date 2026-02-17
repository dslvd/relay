# 💰 Google AdSense Setup Guide

## Quick Start

### 1. Sign Up for Google AdSense

1. Go to [google.com/adsense](https://www.google.com/adsense)
2. Click "Get Started" and sign in with your Google account
3. Enter your website URL (your deployed Vercel URL)
4. Complete the application form

### 2. Get Approved (1-3 days)

**Requirements:**
- Your site must be deployed and live
- Must have original content
- Should have some traffic (not mandatory but helps)
- Must comply with AdSense policies

**Tips for faster approval:**
- Add a Privacy Policy page
- Add an About page
- Ensure your site is fully functional

### 3. Get Your Publisher ID

Once approved:
1. Go to AdSense Dashboard
2. Click on "Account" → "Account Information"
3. Copy your Publisher ID (format: `ca-pub-XXXXXXXXXXXXXXXX`)

### 4. Create Ad Units

1. In AdSense Dashboard, go to "Ads" → "By ad unit"
2. Click "Display ads"
3. Create ad unit for **Main Page**:
   - Name: "CDN Main Page Banner"
   - Ad type: Responsive
   - Copy the `data-ad-slot` ID (10 digit number)
4. Create ad unit for **Download Page**:
   - Name: "CDN Download Page Banner"  
   - Ad type: Responsive
   - Copy the `data-ad-slot` ID

### 5. Add to Your Project

✅ **Already configured with your Publisher ID:** `ca-pub-7504951431311068`

The verification script is already added to your site. Just deploy and wait for Google to verify (usually takes a few hours to 1 day).

#### Vercel Dashboard Setup (Required for Production)
1. Go to your project → Settings → Environment Variables
2. Add variable:
   - Key: `NEXT_PUBLIC_ADSENSE_CLIENT_ID`
   - Value: `ca-pub-7504951431311068`
   - Environment: Production, Preview, Development

#### C. Update Ad Slot IDs in Code (After AdSense Approval)

⚠️ **Important:** You'll need to create ad units and replace the slot IDs after your AdSense account is approved.

**File: `app/page.tsx`** (around line 1000)
```tsx
<AdBanner 
  dataAdSlot="YOUR_MAIN_PAGE_AD_SLOT_ID"  // Replace after creating ad unit
  style={{ marginTop: '2rem', marginBottom: '1rem' }}
/>
```

**File: `app/download/[...path]/page.tsx`** (around line 532)
```tsx
<AdBanner 
  dataAdSlot="YOUR_DOWNLOAD_PAGE_AD_SLOT_ID"  // Replace after creating ad unit
  style={{ marginTop: '1.5rem' }}
/>
```

### 6. Deploy and Test

1. Commit your changes:
   ```bash
   git add .
   git commit -m "Add Google AdSense integration"
   git push
   ```

2. Wait for Vercel to deploy (check deployment status)

3. Visit your site and check:
   - View page source and search for "googlesyndication"
   - Ads may take a few hours to start showing
   - Check AdSense dashboard for impressions

## Expected Earnings

Revenue depends on:
- **Traffic**: More visitors = more money
- **Niche**: Tech/finance ads pay more than general content
- **Geography**: US/UK/CA traffic pays 5-10x more than developing countries
- **Click-through rate (CTR)**: Typically 1-3%

**Rough estimates:**
- **1,000 visitors/month**: $5-20/month
- **10,000 visitors/month**: $50-200/month  
- **100,000 visitors/month**: $500-2,000/month

## Troubleshooting

### Ads not showing?
- **Wait 24-48 hours** after deployment
- Check browser console for errors
- Verify Publisher ID is correct
- Disable ad blockers when testing
- Remember: Ads don't show in localhost (development mode)

### Policy violations?
- Review AdSense Program Policies
- Ensure no copyrighted content uploaded
- Add proper DMCA procedures (already included)

### Low earnings?
- Increase traffic (SEO, social media, etc.)
- Optimize ad placements (A/B test)
- Target high-paying keywords
- Focus on quality traffic sources

## Notes

- ✅ Ads already integrated in strategic locations
- ✅ DMCA policy page included (required for safe harbor)
- ✅ Non-intrusive placements for better UX
- ⚠️ Don't click your own ads (violates policy)
- ⚠️ Requires Vercel deployment (won't work on localhost)

## Support

If you need help:
- AdSense Help Center: [support.google.com/adsense](https://support.google.com/adsense)
- Check your AdSense email for approval updates
- Review the troubleshooting section above
