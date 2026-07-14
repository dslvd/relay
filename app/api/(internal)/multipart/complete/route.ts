import { NextRequest, NextResponse } from 'next/server';
import { completeMultipartUpload } from '@/app/lib/storage/r2-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
    const objectKey = typeof body?.objectKey === 'string' ? body.objectKey : '';
    const parts = Array.isArray(body?.parts) ? body.parts : [];

    if (!uploadId || !objectKey) {
      return NextResponse.json({ error: 'uploadId and objectKey are required' }, { status: 400 });
    }

    const normalizedParts = parts
      .map((p: any) => ({
        partNumber: Number(p?.partNumber),
        etag: typeof p?.etag === 'string' ? p.etag : '',
      }))
      .filter((p: { partNumber: number; etag: string }) => Number.isFinite(p.partNumber) && p.partNumber >= 1 && p.etag);

    if (normalizedParts.length === 0) {
      return NextResponse.json({ error: 'parts are required' }, { status: 400 });
    }

    normalizedParts.sort((a: { partNumber: number; etag: string }, b: { partNumber: number; etag: string }) => a.partNumber - b.partNumber);

    await completeMultipartUpload({
      objectKey,
      uploadId,
      parts: normalizedParts,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to complete multipart upload:', error);
    return NextResponse.json({ error: 'Failed to complete multipart upload' }, { status: 500 });
  }
}
