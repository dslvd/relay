import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { addAbuseReport } from '@/app/lib/data/report-store';
import { checkRateLimit } from '@/app/lib/security/rate-limit';

const MAX_REPORTS_PER_HOUR = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_CATEGORIES = new Set([
  'illegal-content',
  'csam',
  'malware',
  'copyright',
  'phishing-scam',
  'other',
]);

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

// Only /d/ and /download/ resolve to a real object key via
// toObjectKeyFromAppUrl() (see r2-storage.ts), which is what the admin
// dashboard's Disable link / Delete file actions rely on. Accepting any
// other path would let a report through that those buttons can silently do
// nothing with while still getting marked resolved - so this must stay in
// lockstep with that resolver, not just be "any relay.xstlo.com URL".
const VALID_CONTENT_PATH_PREFIXES = ['/d/', '/download/'];

function validateReportedUrl(rawUrl: string, request: NextRequest): { ok: true; url: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Please enter a valid URL' };
  }

  const allowedOrigins = new Set([request.nextUrl.origin]);
  const configuredBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (configuredBase) {
    try {
      allowedOrigins.add(new URL(configuredBase).origin);
    } catch {
      // Ignore a malformed env var - the request's own origin still applies.
    }
  }

  if (!allowedOrigins.has(parsed.origin)) {
    return { ok: false, error: 'Please submit a link to content on Relay, not an external URL' };
  }

  if (!VALID_CONTENT_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return { ok: false, error: 'This doesn’t look like a Relay share link - copy the link exactly as it appears when you open the shared file (it should start with /d/)' };
  }

  return { ok: true, url: parsed.toString() };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(`report-abuse:${ip}`, MAX_REPORTS_PER_HOUR, RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many reports submitted. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 2000) : '';
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 4000) : '';
    const reporterEmail = typeof body?.reporterEmail === 'string' ? body.reporterEmail.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'A URL or link to the content is required' }, { status: 400 });
    }
    const urlCheck = validateReportedUrl(url, request);
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }
    if (!VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'A valid category is required' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'A description is required' }, { status: 400 });
    }
    if (reporterEmail && !EMAIL_PATTERN.test(reporterEmail)) {
      return NextResponse.json({ error: 'Reporter email looks invalid' }, { status: 400 });
    }

    await addAbuseReport({
      id: randomUUID(),
      timestamp: Date.now(),
      url: urlCheck.url,
      category,
      description,
      reporterEmail: reporterEmail || undefined,
      reporterIp: ip,
      status: 'open',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Abuse report error:', error);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
