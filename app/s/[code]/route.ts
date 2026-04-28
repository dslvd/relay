import { NextRequest } from 'next/server';
import { loadShortLink } from '@/app/lib/data/shortlink-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const record = await loadShortLink(code);
  if (!record?.url) {
    return new Response('Not found', { status: 404 });
  }

  // 302 so analytics, etc, still works and is flexible.
  return Response.redirect(record.url, 302);
}

