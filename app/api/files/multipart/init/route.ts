import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/lib/auth/api-auth';
import { createMultipartUpload, buildApiObjectKey } from '@/app/lib/storage/r2-storage';
import { getOwnerStorageUsed } from '@/app/lib/data/api-file-store';
import { getStorageLimit } from '@/app/lib/data/api-key-store';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB parts

// POST /api/files/multipart/init - start a multipart upload for large files
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const ownerId = auth.success ? auth.apiKey!.id : null;

    const body = await request.json().catch(() => ({}));
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const fileSize = Number(body?.fileSize);
    const fileType = typeof body?.fileType === 'string' ? body.fileType : 'application/octet-stream';

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ success: false, error: 'fileSize must be a positive number' }, { status: 400 });
    }

    if (ownerId) {
      const storageLimit = getStorageLimit(auth.apiKey!);
      const used = await getOwnerStorageUsed(ownerId);
      if (used + fileSize > storageLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Storage limit exceeded: ${used} of ${storageLimit} bytes used, this upload needs ${fileSize} more.`,
          },
          { status: 507 }
        );
      }
    }

    const objectKey = buildApiObjectKey(ownerId, fileName);

    const { uploadId, objectKey: key } = await createMultipartUpload({ objectKey, contentType: fileType });
    const totalParts = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));

    return NextResponse.json({
      success: true,
      uploadId,
      key,
      chunkSize: CHUNK_SIZE,
      totalParts,
    });
  } catch (error) {
    console.error('Multipart init error:', error);
    return NextResponse.json({ success: false, error: 'Failed to initialize multipart upload' }, { status: 500 });
  }
}
