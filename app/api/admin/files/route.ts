import { NextRequest, NextResponse } from 'next/server';
import { loadUploadHistory, updateUploadRecordsByUrls } from '@/app/lib/data/upload-history-store';
import { loadQuarantineMap } from '@/app/lib/data/abuse-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
import { requireAdmin } from '@/app/lib/auth/admin-auth';

async function resolveObjectKeyFromUrl(url: string): Promise<string | null> {
  const objectKey = toObjectKeyFromAppUrl(url);
  if (!objectKey) return null;
  const key = objectKey.startsWith('d/') ? objectKey.slice(2) : objectKey;
  const aliasTarget = await resolveAliasObjectKey(key);
  return aliasTarget || objectKey;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'Unknown';
}

function parseTags(input: unknown): string[] | undefined {
  if (Array.isArray(input)) {
    return input
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const [publicHistory, premiumHistory, quarantineMap] = await Promise.all([
    loadUploadHistory('public'),
    loadUploadHistory('premium'),
    loadQuarantineMap(),
  ]);

  const combined = [...publicHistory, ...premiumHistory]
    .sort((a, b) => b.timestamp - a.timestamp);

  const mapped = await Promise.all(
    combined.map(async (record) => {
      const objectKey = await resolveObjectKeyFromUrl(record.url);
      const quarantine = objectKey ? quarantineMap.get(objectKey) : undefined;
      return {
        url: record.url,
        filename: record.filename,
        timestamp: record.timestamp,
        size: record.size,
        ip: record.ip,
        folder: record.folder || '',
        tags: record.tags || [],
        favorite: Boolean(record.favorite),
        displayName: record.displayName || '',
        updatedAt: record.updatedAt || null,
        quarantined: Boolean(quarantine),
        quarantineReason: quarantine?.reason || null,
      };
    })
  );

  return NextResponse.json(
    { history: mapped, count: mapped.length },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

export async function PATCH(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls)
      ? (body.urls as unknown[]).filter((u: unknown): u is string => typeof u === 'string')
      : typeof body?.url === 'string'
        ? [body.url]
        : [];

    const hasFilename = Object.prototype.hasOwnProperty.call(body, 'filename') && typeof body?.filename === 'string';
    const hasFolder = Object.prototype.hasOwnProperty.call(body, 'folder') && typeof body?.folder === 'string';
    const hasDisplayName = Object.prototype.hasOwnProperty.call(body, 'displayName') && typeof body?.displayName === 'string';
    const filename = hasFilename ? body.filename.trim() : undefined;
    const folder = hasFolder ? body.folder.trim() : undefined;
    const displayName = hasDisplayName ? body.displayName.trim() : undefined;
    const favorite = typeof body?.favorite === 'boolean' ? body.favorite : undefined;
    const tags = parseTags(body?.tags);

    if (urls.length === 0) {
      return NextResponse.json({ error: 'url or urls are required' }, { status: 400 });
    }

    const hasUpdate = hasFilename || hasFolder || hasDisplayName || typeof favorite === 'boolean' || typeof tags !== 'undefined';
    if (!hasUpdate) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const nextTimestamp = Date.now();
    const updateCount = await updateUploadRecordsByUrls(urls, (record) => ({
      ...record,
      filename: filename ?? record.filename,
      folder: folder ?? record.folder ?? '',
      displayName: displayName ?? record.displayName ?? '',
      favorite: typeof favorite === 'boolean' ? favorite : Boolean(record.favorite),
      tags: Array.isArray(tags) ? tags : record.tags || [],
      updatedAt: nextTimestamp,
    }), 'public');
    const premiumCount = await updateUploadRecordsByUrls(urls, (record) => ({
      ...record,
      filename: filename ?? record.filename,
      folder: folder ?? record.folder ?? '',
      displayName: displayName ?? record.displayName ?? '',
      favorite: typeof favorite === 'boolean' ? favorite : Boolean(record.favorite),
      tags: Array.isArray(tags) ? tags : record.tags || [],
      updatedAt: nextTimestamp,
    }), 'premium');

    const updated = updateCount + premiumCount;

    await appendAuditLog({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      action: 'file.update',
      actorIp: getClientIp(request),
      userAgent: getUserAgent(request),
      meta: { count: updated, urls, folder, favorite, tags, filename },
    });

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('Admin file update error:', error);
    return NextResponse.json({ error: 'Failed to update file metadata' }, { status: 500 });
  }
}
