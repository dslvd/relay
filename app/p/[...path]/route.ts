import { NextRequest, NextResponse } from 'next/server';
import { updateLastAccessTime } from '@/app/lib/storage/retention';
import { createPresignedDownloadUrl, getObjectMetadata } from '@/app/lib/storage/r2-storage';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { loadQuarantineMap } from '@/app/lib/data/abuse-store';
import { notFoundResponse } from '@/app/lib/not-found-html';

async function resolveObjectKey(pathParts: string[]): Promise<string> {
  const key = pathParts.join('/');
  const aliasTarget = await resolveAliasObjectKey(key);
  return aliasTarget || key;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathname = await resolveObjectKey(path);
    const quarantineMap = await loadQuarantineMap();
    if (quarantineMap.has(pathname)) {
      return new NextResponse(null, { status: 403 });
    }

    const signedUrl = await createPresignedDownloadUrl({
      objectKey: pathname,
      expiresInSeconds: 60,
    });

    const response = await fetch(signedUrl, { cache: 'no-store' });

    if (!response.ok || !response.body) {
      return notFoundResponse('File not found', 'The link points to a file that no longer exists or never did.');
    }

    const filename = path[path.length - 1];
    await updateLastAccessTime(filename);

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': response.headers.get('Content-Length') || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return notFoundResponse('File not found', 'The link points to a file that no longer exists or never did.');
  }
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathname = await resolveObjectKey(path);
    const quarantineMap = await loadQuarantineMap();
    if (quarantineMap.has(pathname)) {
      return new NextResponse(null, { status: 403 });
    }
    const metadata = await getObjectMetadata(pathname);
    if (metadata) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': metadata.contentType || 'application/octet-stream',
          'Content-Length': String(metadata.contentLength ?? 0),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
