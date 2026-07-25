import { NextRequest, NextResponse } from 'next/server';
import { getFileRecordByShortId, incrementDownloadCount } from '@/app/lib/data/api-file-store';
import { buildPublicObjectUrl } from '@/app/lib/storage/r2-storage';

// GET /i/[shortId] - permanent view link for a file uploaded via /api/files/upload.
// Redirects to the public R2 object URL, so it works directly as an <img src>
// or as a link, without needing to re-sign an expiring download URL.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;
  const record = await getFileRecordByShortId(decodeURIComponent(shortId));

  if (!record || (record.expiresAt && Date.now() > record.expiresAt)) {
    return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
  }

  await incrementDownloadCount(record.id);

  return NextResponse.redirect(buildPublicObjectUrl(record.objectKey), { status: 302 });
}
