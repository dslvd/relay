import { NextRequest, NextResponse } from 'next/server';
import { withDeprecatedApiAuth } from '@/app/lib/api-auth';
import { createPresignedUploadUrl, normalizeObjectKey } from '@/app/lib/storage/r2-storage';
import { updateApiKeyUsage } from '@/app/lib/data/api-key-store';

export async function POST(request: NextRequest) {
  return withDeprecatedApiAuth(request, 'upload', async (apiKey) => {
    try {
      const body = await request.json();
      const filename = typeof body?.filename === 'string' ? body.filename : '';
      const contentType = typeof body?.contentType === 'string' ? body.contentType : undefined;
      const size = Number(body?.size);

      if (!filename) {
        return NextResponse.json(
          {
            success: false,
            error: 'filename is required',
          },
          { status: 400 }
        );
      }

      if (!Number.isFinite(size) || size <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'size must be a positive number',
          },
          { status: 400 }
        );
      }

      // Check upload size limit for this API key
      if (size > apiKey.rateLimit.uploadSizeLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `File size exceeds limit of ${apiKey.rateLimit.uploadSizeLimit} bytes`,
          },
          { status: 413 }
        );
      }

      // Generate a unique path for the file
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const pathname = `d/api/${apiKey.id}/${timestamp}-${randomId}/${filename}`;

      const objectKey = normalizeObjectKey(pathname);
      const uploadUrl = await createPresignedUploadUrl({
        objectKey,
        contentType,
        expiresInSeconds: 300, // 5 minutes to complete the upload
      });

      // Update API key usage
      await updateApiKeyUsage(apiKey.id, {
        uploadCount: 1,
        bytesUploaded: size,
      });

      const downloadPageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/d/${objectKey}`;
      const directDownloadUrl = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/dl/${objectKey}`;

      return NextResponse.json({
        success: true,
        data: {
          uploadUrl,
          method: 'PUT',
          fileId: objectKey,
          downloadUrl: downloadPageUrl, // Changed from directDownloadUrl
          directDownloadUrl,
          downloadPageUrl,
          expiresIn: 300,
          headers: {
            'Content-Type': contentType || 'application/octet-stream',
          },
        },
      });
    } catch (error) {
      console.error('API upload error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create upload URL',
        },
        { status: 500 }
      );
    }
  });
}
