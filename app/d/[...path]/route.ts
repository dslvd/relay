import { NextRequest, NextResponse } from 'next/server';
import { updateLastAccessTime } from '@/app/lib/storage/retention';
import { createPresignedDownloadUrl, getObjectMetadata } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory } from '@/app/lib/data/upload-history-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { loadQuarantineMap } from '@/app/lib/data/abuse-store';
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

function fileNotFoundResponse(): NextResponse {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>File not found</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0b0d;
        --card: rgba(255, 255, 255, 0.06);
        --border: rgba(255, 255, 255, 0.16);
        --text: #f5f5f5;
        --muted: rgba(245, 245, 245, 0.62);
        --accent: #ffffff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Open Sans", system-ui, -apple-system, sans-serif;
        background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08), transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05), transparent 42%),
          var(--bg);
        color: var(--text);
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
      }
      .shell {
        width: min(880px, 92vw);
        border-radius: 28px;
        border: 1px solid var(--border);
        background: var(--card);
        backdrop-filter: blur(18px);
        padding: 3.2rem;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
      }
      .eyebrow {
        font-size: 0.8rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h1 {
        margin: 0.8rem 0 0.6rem;
        font-size: clamp(2rem, 4vw, 3.1rem);
        letter-spacing: -0.02em;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 1rem;
      }
      .actions {
        margin-top: 2.2rem;
        display: flex;
        gap: 0.9rem;
        flex-wrap: wrap;
      }
      a.button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.2rem;
        border-radius: 999px;
        border: 1px solid var(--accent);
        color: #0a0a0a;
        background: var(--accent);
        text-decoration: none;
        font-weight: 700;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      a.button:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(255, 255, 255, 0.15);
      }
      .ghost {
        border-color: var(--border);
        background: transparent;
        color: var(--text);
      }
      .divider {
        margin-top: 2rem;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      }
      .hint {
        margin-top: 1.4rem;
        font-size: 0.85rem;
        color: rgba(245, 245, 245, 0.5);
      }
    </style>
  </head>
  <body>
    <section class="shell">
      <div class="eyebrow">404</div>
      <h1>File not found</h1>
      <p>The link points to a file that no longer exists or never did.</p>
      <div class="actions">
        <a class="button ghost" href="/">Upload a new file</a>
      </div>
      <div class="divider"></div>
      <div class="hint">Contact the file owner if you believe this is an error.</div>
    </section>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function fileQuarantinedResponse(): NextResponse {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>File quarantined</title>
    <style>
      :root { color-scheme: dark; --bg: #0b0b0d; --text: #f5f5f5; --muted: rgba(245,245,245,0.6); }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Open Sans", system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: grid; place-items: center; padding: 2rem; }
      .card { width: min(720px, 92vw); border-radius: 20px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.05); padding: 2.6rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
      h1 { margin: 0 0 0.6rem; font-size: clamp(1.8rem, 4vw, 2.6rem); }
      p { margin: 0; color: var(--muted); }
    </style>
  </head>
  <body>
    <section class="card">
      <h1>File quarantined</h1>
      <p>This file is unavailable while it is under review.</p>
    </section>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
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
      return fileNotFoundResponse();
    }
    
    // Get the file content
    if (!response.body) {
      return fileNotFoundResponse();
    }
    
    // Update last access time to reset the deletion timer
    const key = path.join('/');
    const filename = path[path.length - 1];
    await updateLastAccessTime(filename);
    
    // ?dl= means the request came from the download page, which posts its own
    // analytics event. Only track here for direct /d/[...] hits to avoid
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
    return fileNotFoundResponse();
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
