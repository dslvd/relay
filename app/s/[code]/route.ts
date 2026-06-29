import { NextRequest } from 'next/server';
import { loadShortLink } from '@/app/lib/data/shortlink-store';
import { notFoundResponse } from '@/app/lib/not-found-html';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const record = await loadShortLink(code);
  if (!record?.url) {
    return notFoundResponse('Link not found', 'This short link doesn\'t exist or has expired.');
  }

  // 302 so analytics, etc, still works and is flexible.
  return Response.redirect(record.url, 302);
}

