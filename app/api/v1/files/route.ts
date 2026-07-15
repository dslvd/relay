import { NextRequest, NextResponse } from 'next/server';
import { withDeprecatedApiAuth } from '@/app/lib/auth/api-auth';
import { listAllObjects } from '@/app/lib/storage/r2-storage';

// GET /api/v1/files - List all files for an API key
export async function GET(request: NextRequest) {
  return withDeprecatedApiAuth(request, 'list', async (apiKey) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
      const prefix = searchParams.get('prefix') || `d/api/${apiKey.id}/`;

      // List objects with the API key's prefix
      const objects = await listAllObjects(prefix);

      // Format the response
      const files = objects.slice(0, limit).map((obj) => ({
        fileId: obj.Key || '',
        name: obj.Key?.split('/').pop() || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified?.toISOString() || '',
        downloadUrl: `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/api/v1/files/${encodeURIComponent(obj.Key || '')}`,
        directDownloadUrl: `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/dl/${obj.Key || ''}`,
      }));

      return NextResponse.json({
        success: true,
        data: {
          files,
          count: files.length,
          total: objects.length,
          hasMore: objects.length > limit,
        },
      });
    } catch (error) {
      console.error('API list files error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to list files',
        },
        { status: 500 }
      );
    }
  });
}
