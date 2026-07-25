import { NextRequest, NextResponse } from 'next/server';
import { abortMultipartUpload } from '@/app/lib/storage/r2-storage';

// POST /api/files/multipart/abort - release an in-progress multipart upload
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key : '';
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';

    if (!key || !uploadId) {
      return NextResponse.json({ success: false, error: 'key and uploadId are required' }, { status: 400 });
    }

    await abortMultipartUpload({ objectKey: key, uploadId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Multipart abort error:', error);
    return NextResponse.json({ success: false, error: 'Failed to abort multipart upload' }, { status: 500 });
  }
}
