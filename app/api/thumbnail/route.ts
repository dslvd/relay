import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createPresignedDownloadUrl, getObjectMetadata } from '@/app/lib/storage/r2-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')?.trim() || '';
    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    const w = clampInt(request.nextUrl.searchParams.get('w'), 320, 64, 1024);
    const h = clampInt(request.nextUrl.searchParams.get('h'), 0, 0, 1024);

    const objectKey = `d/${key}`;
    const meta = await getObjectMetadata(objectKey);
    const contentType = meta?.contentType || '';

    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 400 });
    }

    const signedUrl = await createPresignedDownloadUrl({ objectKey, expiresInSeconds: 60 });
    const res = await fetch(signedUrl, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const input = Buffer.from(await res.arrayBuffer());
    const pipeline = sharp(input).rotate();

    const resized = h > 0
      ? pipeline.resize(w, h, { fit: 'cover' })
      : pipeline.resize(w, undefined, { fit: 'inside', withoutEnlargement: true });

    const output = await resized.webp({ quality: 72 }).toBuffer();
    const body = new Uint8Array(output);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        // Thumbnails are derived from immutable objects (until they expire).
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Thumbnail error:', error);
    return NextResponse.json({ error: 'Failed to generate thumbnail' }, { status: 500 });
  }
}
