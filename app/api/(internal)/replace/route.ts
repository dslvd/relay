import { NextRequest, NextResponse } from 'next/server';
import { createPresignedUploadUrl, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';

export const dynamic = 'force-dynamic';

// POST /api/replace — presigns a PUT to the *same* object key an existing
// file already lives at, so a new upload overwrites it in place. This is a
// straight overwrite, not version history: the old bytes are gone once the
// new PUT completes. Same no-auth-beyond-the-URL model as /api/delete.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : undefined;

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const objectKey = toObjectKeyFromAppUrl(url);
    if (!objectKey) {
      return NextResponse.json({ error: 'Could not resolve object key from URL' }, { status: 400 });
    }

    const uploadUrl = await createPresignedUploadUrl({
      objectKey,
      contentType,
      expiresInSeconds: 300,
    });

    return NextResponse.json({ success: true, data: { uploadUrl, objectKey } });
  } catch (error) {
    console.error('Replace-file presign error:', error);
    return NextResponse.json({ error: 'Failed to prepare replacement upload' }, { status: 500 });
  }
}
