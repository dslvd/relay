import { NextRequest, NextResponse } from 'next/server';
import { createPresignedUploadPartUrl } from '@/app/lib/storage/r2-storage';

const MAX_PARTS_PER_REQUEST = 500;

// POST /api/files/multipart/batch-urls - presign a batch of part-upload URLs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key : '';
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
    const totalParts = Number(body?.totalParts);

    if (!key || !uploadId) {
      return NextResponse.json({ success: false, error: 'key and uploadId are required' }, { status: 400 });
    }
    if (!Number.isFinite(totalParts) || totalParts <= 0 || totalParts > MAX_PARTS_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `totalParts must be between 1 and ${MAX_PARTS_PER_REQUEST}` },
        { status: 400 }
      );
    }

    const urls: Record<string, string> = {};
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      urls[String(partNumber)] = await createPresignedUploadPartUrl({
        objectKey: key,
        uploadId,
        partNumber,
        expiresInSeconds: 3600,
      });
    }

    return NextResponse.json({ success: true, urls });
  } catch (error) {
    console.error('Multipart batch-urls error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate upload URLs' }, { status: 500 });
  }
}
