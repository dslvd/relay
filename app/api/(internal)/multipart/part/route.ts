import { NextRequest, NextResponse } from 'next/server';
import { createPresignedUploadPartUrl } from '@/app/lib/storage/r2-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
    const objectKey = typeof body?.objectKey === 'string' ? body.objectKey : '';
    const partNumber = Number(body?.partNumber);

    if (!uploadId || !objectKey) {
      return NextResponse.json({ error: 'uploadId and objectKey are required' }, { status: 400 });
    }
    if (!Number.isFinite(partNumber) || partNumber < 1 || partNumber > 10_000) {
      return NextResponse.json({ error: 'Invalid partNumber' }, { status: 400 });
    }

    const url = await createPresignedUploadPartUrl({
      objectKey,
      uploadId,
      partNumber,
      expiresInSeconds: 300,
    });

    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Failed to presign part upload:', error);
    return NextResponse.json({ error: 'Failed to presign part upload' }, { status: 500 });
  }
}