import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/lib/auth/api-auth';
import { createPresignedUploadUrl, createPresignedDownloadUrl, buildApiObjectKey } from '@/app/lib/storage/r2-storage';
import { createFileRecord, getOwnerStorageUsed } from '@/app/lib/data/api-file-store';
import { getStorageLimit } from '@/app/lib/data/api-key-store';
import { dispatchFileWebhook } from '@/app/lib/webhooks/dispatch';

const ANON_MAX_FILE_BYTES = 25 * 1024 * 1024 * 1024; // 25GB, matches rootz's anonymous cap
const ANON_EXPIRY_MS = 15 * 24 * 60 * 60 * 1000; // 15 days, matches rootz's anonymous expiry

function toApiFileResponse(record: {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: number;
  isAnonymous: boolean;
  expiresAt: number | null;
  shortId: string;
}, url: string, viewUrl: string) {
  return {
    id: record.id,
    name: record.name,
    size: record.size,
    url,
    viewUrl,
    mimeType: record.mimeType,
    createdAt: new Date(record.createdAt).toISOString(),
    isAnonymous: record.isAnonymous,
    expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
    shortId: record.shortId,
  };
}

// POST /api/files/upload - direct upload for files under ~4MB (rootz-compatible)
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const ownerId = auth.success ? auth.apiKey!.id : null;

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ success: false, error: 'Expected multipart/form-data body' }, { status: 400 });
    }

    const file = formData.get('file');
    const folderId = formData.get('folderId');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 });
    }

    const maxFileBytes = ownerId ? Math.max(ANON_MAX_FILE_BYTES, auth.apiKey!.rateLimit.uploadSizeLimit) : ANON_MAX_FILE_BYTES;
    if (file.size > maxFileBytes) {
      return NextResponse.json(
        { success: false, error: `Anonymous uploads are limited to ${Math.round(ANON_MAX_FILE_BYTES / (1024 ** 3))}GB. Please create an account for larger files.` },
        { status: 413 }
      );
    }

    if (ownerId) {
      const storageLimit = getStorageLimit(auth.apiKey!);
      const used = await getOwnerStorageUsed(ownerId);
      if (used + file.size > storageLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Storage limit exceeded: ${used} of ${storageLimit} bytes used, this upload needs ${file.size} more.`,
          },
          { status: 507 }
        );
      }
    }

    const objectKey = buildApiObjectKey(ownerId, file.name);
    const contentType = file.type || 'application/octet-stream';

    const uploadUrl = await createPresignedUploadUrl({ objectKey, contentType, expiresInSeconds: 60 });
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: await file.arrayBuffer(),
    });

    if (!putRes.ok) {
      return NextResponse.json({ success: false, error: 'Failed to store file' }, { status: 502 });
    }

    const record = await createFileRecord({
      objectKey,
      name: file.name,
      size: file.size,
      mimeType: contentType,
      folderId: typeof folderId === 'string' && folderId ? folderId : null,
      ownerId,
      expiresAt: ownerId ? null : Date.now() + ANON_EXPIRY_MS,
    });

    const downloadUrl = await createPresignedDownloadUrl({ objectKey, expiresInSeconds: 24 * 60 * 60 });
    const viewUrl = new URL(`/i/${record.shortId}`, request.nextUrl.origin).toString();

    if (auth.success) {
      dispatchFileWebhook(auth.apiKey!, 'file.created', {
        id: record.id,
        name: record.name,
        size: record.size,
        mimeType: record.mimeType,
        shortId: record.shortId,
      });
    }

    return NextResponse.json({
      success: true,
      data: toApiFileResponse(record, downloadUrl, viewUrl),
    });
  } catch (error) {
    console.error('Files upload error:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 });
  }
}
