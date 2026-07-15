import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/lib/auth/api-auth';
import { completeMultipartUpload, createPresignedDownloadUrl } from '@/app/lib/storage/r2-storage';
import { createFileRecord } from '@/app/lib/data/api-file-store';

const ANON_EXPIRY_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

// POST /api/files/multipart/complete - finalize a multipart upload
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const ownerId = auth.success ? auth.apiKey!.id : null;

    const body = await request.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key : '';
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
    const parts = Array.isArray(body?.parts) ? body.parts : [];
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const fileSize = Number(body?.fileSize);
    const contentType = typeof body?.contentType === 'string' ? body.contentType : 'application/octet-stream';
    const folderId = typeof body?.folderId === 'string' && body.folderId ? body.folderId : null;

    if (!key || !uploadId || !fileName || !parts.length) {
      return NextResponse.json(
        { success: false, error: 'key, uploadId, fileName, and parts are required' },
        { status: 400 }
      );
    }

    const sortedParts = [...parts]
      .map((p: { partNumber: number; etag: string }) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) }))
      .sort((a, b) => a.partNumber - b.partNumber);

    await completeMultipartUpload({ objectKey: key, uploadId, parts: sortedParts });

    const record = await createFileRecord({
      objectKey: key,
      name: fileName,
      size: Number.isFinite(fileSize) ? fileSize : 0,
      mimeType: contentType,
      folderId,
      ownerId,
      expiresAt: ownerId ? null : Date.now() + ANON_EXPIRY_MS,
    });

    const url = await createPresignedDownloadUrl({ objectKey: key, expiresInSeconds: 24 * 60 * 60 });

    return NextResponse.json({
      success: true,
      file: {
        id: record.id,
        name: record.name,
        size: record.size,
        url,
        mimeType: record.mimeType,
        createdAt: new Date(record.createdAt).toISOString(),
        isAnonymous: record.isAnonymous,
        expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
        shortId: record.shortId,
      },
    });
  } catch (error) {
    console.error('Multipart complete error:', error);
    return NextResponse.json({ success: false, error: 'Failed to complete multipart upload' }, { status: 500 });
  }
}
