import { NextRequest, NextResponse } from 'next/server';
import { updateLastAccessTime } from '@/app/lib/storage/retention';
import { createPresignedDownloadUrl, getObjectMetadata } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory } from '@/app/lib/data/upload-history-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { loadQuarantineMap } from '@/app/lib/data/abuse-store';
import { notFoundHtml, notFoundResponse } from '@/app/lib/not-found-html';
import {
  cleanupAnalyticsData,
  loadAnalyticsData,
  recordDownloadEvent,
  saveAnalyticsData,
} from '@/app/lib/data/analytics-store';

function getCountry(request: NextRequest): string | undefined {
  const fromVercel = request.headers.get('x-vercel-ip-country');
  const fromCf = request.headers.get('cf-ipcountry');
  const value = (fromVercel || fromCf || '').trim();
  return value ? value : undefined;
}

function buildContentDispositionAttachment(filename: string): string {
  // RFC 5987 filename* for UTF-8, plus a conservative fallback.
  const fallback = filename.replace(/[/\\]/g, '-').replace(/[\u0000-\u001f\u007f]/g, '').trim() || 'download';
  const encoded = encodeURIComponent(fallback);
  return `attachment; filename="${fallback.replace(/"/g, '')}"; filename*=UTF-8''${encoded}`;
}

async function findOriginalFilenameByKey(key: string): Promise<string | null> {
  const histories = await Promise.all([loadUploadHistory('public'), loadUploadHistory('premium')]);

  for (const history of histories) {
    for (const record of history) {
      try {
        const parsed = new URL(record.url, 'http://localhost');
        if (
          parsed.pathname === `/download/${key}` ||
          parsed.pathname.endsWith(`/download/${key}`) ||
          parsed.pathname === `/d/${key}` ||
          parsed.pathname.endsWith(`/d/${key}`)
        ) {
          return record.filename || null;
        }
        // Many links are just `/download/<lastSegment>` (or `/d/<lastSegment>`).
        const last = key.split('/').pop() || key;
        if (
          parsed.pathname === `/download/${last}` ||
          parsed.pathname.endsWith(`/download/${last}`) ||
          parsed.pathname === `/d/${last}` ||
          parsed.pathname.endsWith(`/d/${last}`)
        ) {
          return record.filename || null;
        }
      } catch {
        if (record.url.includes(key)) return record.filename || null;
      }
    }
  }

  return null;
}

function fileQuarantinedResponse(): NextResponse {
  return new NextResponse(notFoundHtml('File unavailable', 'This file is unavailable while it is under review.').replace('>404<', '>403<'), {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function resolveDownloadObjectKey(pathParts: string[]): Promise<string> {
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
    const pathname = await resolveDownloadObjectKey(path);
    const quarantineMap = await loadQuarantineMap();
    if (quarantineMap.has(pathname)) {
      return fileQuarantinedResponse();
    }

    const signedUrl = await createPresignedDownloadUrl({
      objectKey: pathname,
      expiresInSeconds: 60,
    });

    // Fetch and proxy the file content
    const response = await fetch(signedUrl, { cache: 'no-store' });

    if (!response.ok) {
      return notFoundResponse('File not found', 'The link points to a file that no longer exists or never did.');
    }

    // Get the file content
    if (!response.body) {
      return notFoundResponse('File not found', 'The link points to a file that no longer exists or never did.');
    }

    // Update last access time to reset the deletion timer
    const key = path.join('/');
    const filename = path[path.length - 1];
    await updateLastAccessTime(filename);

    // ?dl= means the request came from the download page, which posts its own
    // analytics event. Only track here for direct /dl/[...] hits to avoid
    // double-counting.
    const shouldDownload = request.nextUrl.searchParams.has('dl');
    if (!shouldDownload) {
      try {
        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'Unknown';
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const referer = request.headers.get('referer') || undefined;

        let analyticsData = cleanupAnalyticsData(await loadAnalyticsData());
        analyticsData = await recordDownloadEvent(analyticsData, {
          filename,
          fileKey: key,
          ip,
          userAgent,
          bytes: Number(response.headers.get('Content-Length')) || undefined,
          referer,
          country: getCountry(request),
        });
        await saveAnalyticsData(analyticsData);
      } catch (err) {
        console.error('[analytics] failed to record direct download:', err);
      }
    }
    const originalFilename = shouldDownload ? await findOriginalFilenameByKey(key) : null;

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': response.headers.get('Content-Length') || '',
        ...(shouldDownload
          ? { 'Content-Disposition': buildContentDispositionAttachment(originalFilename || path[path.length - 1] || 'download') }
          : {}),
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error proxying file:', error);
    return notFoundResponse('File not found', 'The link points to a file that no longer exists or never did.');
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathname = await resolveDownloadObjectKey(path);
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
        }
      });
    }

    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
