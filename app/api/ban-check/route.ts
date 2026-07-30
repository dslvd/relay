import { NextRequest, NextResponse } from 'next/server';
import { isBlacklisted } from '@/app/lib/data/abuse-store';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

// Unauthenticated, read-only check against the same blacklist rules already
// enforced at upload time (multipart/init, upload, snippet, remote-upload) -
// this just surfaces that same status to the visitor as a banner instead of
// only rejecting them silently the moment they try to upload something.
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const banned = ip !== 'Unknown' && (await isBlacklisted(ip));

  return NextResponse.json(
    { banned },
    { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
  );
}
