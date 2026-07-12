import { NextRequest, NextResponse } from 'next/server';
import { createPresignedDownloadUrl } from '@/app/lib/storage/r2-storage';
import { getFileRecordById, incrementDownloadCount } from '@/app/lib/data/api-file-store';

// GET /api/files/download/[fileId] - get a signed download URL for a file (rootz-compatible)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const record = await getFileRecordById(decodeURIComponent(fileId));

    if (!record) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const url = await createPresignedDownloadUrl({ objectKey: record.objectKey, expiresInSeconds: 3600 });
    await incrementDownloadCount(record.id);

    return NextResponse.json({
      success: true,
      data: {
        url,
        fileName: record.name,
        size: record.size,
        mimeType: record.mimeType,
        expiresIn: 3600,
        expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
        downloads: record.downloadCount + 1,
        canDelete: false,
        shortId: record.shortId,
      },
    });
  } catch (error) {
    console.error('Files download error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get download URL' }, { status: 500 });
  }
}
