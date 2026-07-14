import { NextRequest, NextResponse } from 'next/server';
import { abortMultipartUpload } from '@/app/lib/storage/r2-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
    const objectKey = typeof body?.objectKey === 'string' ? body.objectKey : '';

    if (!uploadId || !objectKey) {
      return NextResponse.json({ error: 'uploadId and objectKey are required' }, { status: 400 });
    }

    await abortMultipartUpload({ uploadId, objectKey });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to abort multipart upload:', error);
    return NextResponse.json({ error: 'Failed to abort multipart upload' }, { status: 500 });
  }
}

