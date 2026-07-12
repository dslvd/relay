import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { removeUploadUrls } from '@/app/lib/data/upload-history-store';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const objectKey = toObjectKeyFromAppUrl(url);
    if (!objectKey) {
      return NextResponse.json({ error: 'Could not resolve object key from URL' }, { status: 400 });
    }

    // Delete from R2 and strip from both history scopes concurrently
    await Promise.all([
      deleteObject(objectKey),
      removeUploadUrls([url], 'public'),
      removeUploadUrls([url], 'plus'),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
