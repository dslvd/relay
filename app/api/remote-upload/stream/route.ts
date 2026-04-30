import { NextRequest } from 'next/server';
import {
  createMultipartUpload,
  completeMultipartUpload,
  normalizeObjectKey,
  getR2BucketName,
  getR2Client,
} from '@/app/lib/storage/r2-storage';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { deleteExpiredBlobs, pruneExpiredHistoryCache } from '@/app/lib/storage/retention';
import { getPremiumUserFromSession } from '@/app/lib/auth/premium-auth';
import { isBlacklisted } from '@/app/lib/data/abuse-store';

const FREE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const PREMIUM_MAX_FILE_BYTES = 500 * 1024 * 1024;
const PREMIUM_COOKIE_NAME = 'premium_auth';
const PART_SIZE = 8 * 1024 * 1024;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

function sanitizeFilename(input: string): string {
  return input
    .replace(/[/\\]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 180) || 'remote-file';
}

function tryGetFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        const body = await request.json().catch(() => ({}));
        const sourceUrl = typeof body?.url === 'string' ? body.url.trim() : '';
        const filenameOverride = typeof body?.filename === 'string' ? body.filename.trim() : '';
        const extraHeadersRaw =
          body?.headers && typeof body.headers === 'object'
            ? (body.headers as Record<string, unknown>)
            : null;

        if (!sourceUrl) {
          send({ type: 'error', error: 'url is required' });
          controller.close();
          return;
        }

        let parsedUrl: URL;
        try {
          parsedUrl = new URL(sourceUrl);
        } catch {
          send({ type: 'error', error: 'Invalid URL' });
          controller.close();
          return;
        }

        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          send({ type: 'error', error: 'URL must start with http:// or https://' });
          controller.close();
          return;
        }

        const allowedHeaderNames = new Set(['authorization', 'cookie', 'referer']);
        const extraHeaders: Record<string, string> = {};
        if (extraHeadersRaw) {
          for (const [k, v] of Object.entries(extraHeadersRaw)) {
            if (!allowedHeaderNames.has(k.toLowerCase())) continue;
            if (typeof v !== 'string') continue;
            const trimmed = v.trim();
            if (!trimmed) continue;
            extraHeaders[k] = trimmed;
          }
        }

        const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
        const premiumUser = token ? await getPremiumUserFromSession(token) : null;
        const maxFileBytes = premiumUser ? PREMIUM_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES;

        send({ type: 'start' });

        const remoteResponse = await fetch(sourceUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'accept-encoding': 'identity',
            'user-agent': 'RelayRemoteUploader/1.0',
            ...extraHeaders,
          },
        });

        if (!remoteResponse.ok || !remoteResponse.body) {
          send({ type: 'error', error: `Failed to fetch remote URL (status ${remoteResponse.status})` });
          controller.close();
          return;
        }

        const contentType = remoteResponse.headers.get('content-type') || 'application/octet-stream';
        const contentLengthHeader = remoteResponse.headers.get('content-length');
        const declaredSize = contentLengthHeader ? Number(contentLengthHeader) : NaN;
        if (Number.isFinite(declaredSize) && declaredSize > maxFileBytes) {
          send({ type: 'error', error: 'File too large' });
          controller.close();
          return;
        }

        const dispositionName = tryGetFilenameFromContentDisposition(remoteResponse.headers.get('content-disposition'));
        const urlNameRaw = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
        const originalFilename = sanitizeFilename(filenameOverride || dispositionName || urlNameRaw || 'remote-file');

        const ip = getClientIp(request);
        if (await isBlacklisted(ip, originalFilename)) {
          send({ type: 'error', error: 'Upload blocked' });
          controller.close();
          return;
        }

        // Preserve extension from provided/remote name if present.
        const originalExt = originalFilename.includes('.') ? `.${originalFilename.split('.').pop()}` : '';
        const randomBasename = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const objectKey = normalizeObjectKey(`d/${randomBasename}${originalExt}`);

        const { uploadId } = await createMultipartUpload({ objectKey, contentType });

        let downloaded = 0;
        let uploaded = 0;
        const total = Number.isFinite(declaredSize) ? declaredSize : null;
        const parts: Array<{ partNumber: number; etag: string }> = [];

        const reader = remoteResponse.body.getReader();
        let partNumber = 1;
        let buf = new Uint8Array(0);

        const flushPart = async (chunk: Uint8Array) => {
          if (chunk.byteLength === 0) return;
          uploaded += chunk.byteLength;
          if (uploaded > maxFileBytes) {
            throw new Error('File too large');
          }

          const res = await getR2Client().send(
            new UploadPartCommand({
              Bucket: getR2BucketName(),
              Key: objectKey,
              UploadId: uploadId,
              PartNumber: partNumber,
              Body: chunk,
            })
          );

          const etag = (res.ETag || '').replace(/^\"|\"$/g, '') || res.ETag || '';
          if (!etag) {
            throw new Error('Missing ETag from upload part');
          }
          parts.push({ partNumber, etag });
          send({ type: 'progress', stage: 'upload', loaded: uploaded, total, partNumber });
          partNumber += 1;
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          downloaded += value.byteLength;
          if (downloaded > maxFileBytes) {
            throw new Error('File too large');
          }

          // Append to buffer
          const next = new Uint8Array(buf.byteLength + value.byteLength);
          next.set(buf, 0);
          next.set(value, buf.byteLength);
          buf = next;

          // Emit download progress even before part flush.
          send({ type: 'progress', stage: 'download', loaded: downloaded, total });

          while (buf.byteLength >= PART_SIZE) {
            const part = buf.slice(0, PART_SIZE);
            buf = buf.slice(PART_SIZE);
            await flushPart(part);
          }
        }

        if (buf.byteLength > 0) {
          await flushPart(buf);
        }

        await completeMultipartUpload({ objectKey, uploadId, parts });
        await deleteExpiredBlobs();
        await pruneExpiredHistoryCache();

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
        const fileKey = objectKey.split('/').pop() || '';
        const downloadUrl = `${baseUrl}/download/${fileKey}`;

        send({
          type: 'done',
          data: {
            url: downloadUrl,
            filename: originalFilename,
            size: total ?? downloaded,
            contentType,
          },
        });
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Remote upload failed';
        send({ type: 'error', error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
