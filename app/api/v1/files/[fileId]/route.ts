import { NextRequest, NextResponse } from 'next/server';
import { withDeprecatedApiAuth } from '@/app/lib/auth/api-auth';
import {
  getObjectMetadata,
  createPresignedDownloadUrl,
  deleteObject,
  normalizeObjectKey,
} from '@/app/lib/storage/r2-storage';
import { updateApiKeyUsage } from '@/app/lib/data/api-key-store';

// GET /api/v1/files/[fileId] - Get file information and download URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  return withDeprecatedApiAuth(request, 'download', async (apiKey) => {
    try {
      const { fileId: rawFileId } = await params;
      const fileId = decodeURIComponent(rawFileId);
      const objectKey = normalizeObjectKey(fileId);

      const metadata = await getObjectMetadata(objectKey);

      if (!metadata) {
        return NextResponse.json(
          {
            success: false,
            error: 'File not found',
          },
          { status: 404 }
        );
      }

      // Create a presigned download URL
      const downloadUrl = await createPresignedDownloadUrl({
        objectKey,
        expiresInSeconds: 3600, // 1 hour
      });

      const directDownloadUrl = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/dl/${objectKey}`;

      // Update API key usage
      await updateApiKeyUsage(apiKey.id, {
        downloadCount: 1,
        bytesDownloaded: metadata.contentLength || 0,
      });

      return NextResponse.json({
        success: true,
        data: {
          fileId: objectKey,
          downloadUrl,
          directDownloadUrl,
          contentType: metadata.contentType,
          size: metadata.contentLength,
          expiresIn: 3600,
        },
      });
    } catch (error) {
      console.error('API get file error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get file information',
        },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/v1/files/[fileId] - Delete a file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  return withDeprecatedApiAuth(request, 'delete', async (apiKey) => {
    try {
      const { fileId: rawFileId } = await params;
      const fileId = decodeURIComponent(rawFileId);
      const objectKey = normalizeObjectKey(fileId);

      // Check if file exists
      const metadata = await getObjectMetadata(objectKey);

      if (!metadata) {
        return NextResponse.json(
          {
            success: false,
            error: 'File not found',
          },
          { status: 404 }
        );
      }

      // Delete the file
      await deleteObject(objectKey);

      return NextResponse.json({
        success: true,
        data: {
          message: 'File deleted successfully',
          fileId: objectKey,
        },
      });
    } catch (error) {
      console.error('API delete file error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete file',
        },
        { status: 500 }
      );
    }
  });
}
