import { NextRequest, NextResponse } from 'next/server';
import { loadShortLink, saveShortLink } from '@/app/lib/data/shortlink-store';

function randomCode(length = 7): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

function isSafeLocalTarget(request: NextRequest, url: string): boolean {
  // Only allow shortening URLs on this same site, and only under /download/.
  try {
    const base = request.nextUrl.origin;
    const parsed = new URL(url, base);
    if (parsed.origin !== base) return false;
    return parsed.pathname.startsWith('/download/');
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const target = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!target) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    if (!isSafeLocalTarget(request, target)) {
      return NextResponse.json({ error: 'Only /download/* URLs on this site can be shortened' }, { status: 400 });
    }

    // Generate a unique code.
    let code = '';
    for (let i = 0; i < 6; i++) {
      code = randomCode(7);
      const existing = await loadShortLink(code);
      if (!existing) break;
      code = '';
    }

    if (!code) {
      return NextResponse.json({ error: 'Failed to allocate short code' }, { status: 500 });
    }

    await saveShortLink(code, target);

    const shortUrl = `${request.nextUrl.origin}/s/${code}`;
    return NextResponse.json({ success: true, data: { code, shortUrl, target } });
  } catch (error) {
    console.error('Shorten error:', error);
    return NextResponse.json({ error: 'Failed to shorten URL' }, { status: 500 });
  }
}

