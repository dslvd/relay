import { NextRequest, NextResponse } from 'next/server';
import { withDeprecatedApiAuth } from '@/app/lib/auth/api-auth';

// GET /api/v1/info - Get API key information and usage stats
export async function GET(request: NextRequest) {
  return withDeprecatedApiAuth(request, null, async (apiKey) => {
    try {
      return NextResponse.json({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          createdAt: new Date(apiKey.createdAt).toISOString(),
          lastUsedAt: apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toISOString() : null,
          expiresAt: apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString() : null,
          isActive: apiKey.isActive,
          permissions: apiKey.permissions,
          rateLimit: {
            requestsPerHour: apiKey.rateLimit.requestsPerHour,
            uploadSizeLimit: apiKey.rateLimit.uploadSizeLimit,
            uploadSizeLimitMB: Math.round(apiKey.rateLimit.uploadSizeLimit / (1024 * 1024)),
          },
          usage: {
            requestCount: apiKey.usage.requestCount,
            uploadCount: apiKey.usage.uploadCount,
            downloadCount: apiKey.usage.downloadCount,
            totalBytesUploaded: apiKey.usage.totalBytesUploaded,
            totalBytesDownloaded: apiKey.usage.totalBytesDownloaded,
            totalUploadedMB: Math.round(apiKey.usage.totalBytesUploaded / (1024 * 1024) * 100) / 100,
            totalDownloadedMB: Math.round(apiKey.usage.totalBytesDownloaded / (1024 * 1024) * 100) / 100,
          },
        },
      });
    } catch (error) {
      console.error('API info error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get API key information',
        },
        { status: 500 }
      );
    }
  });
}
