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
      url,
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
