import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory, removeUploadUrls, updateUploadRecordsByUrls } from '@/app/lib/data/upload-history-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
import { removeQuarantineRecord, upsertQuarantineRecord } from '@/app/lib/data/abuse-store';
import { requireAdmin } from '@/app/lib/auth/admin-auth';

type BulkAction = 'delete' | 'expire' | 'quarantine' | 'unquarantine' | 'move';

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

async function resolveObjectKeyFromUrl(url: string): Promise<string | null> {
  const objectKey = toObjectKeyFromAppUrl(url);
  if (!objectKey) return null;
  const key = objectKey.startsWith('d/') ? objectKey.slice(2) : objectKey;
  const aliasTarget = await resolveAliasObjectKey(key);
  return aliasTarget || objectKey;
}


export async function POST(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action as BulkAction;
    const urls: string[] = Array.isArray(body?.urls)
      ? (body.urls as unknown[]).filter((u: unknown): u is string => typeof u === 'string')
      : [];
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const folder = typeof body?.folder === 'string' ? body.folder.trim() : '';

    if (!action || urls.length === 0) {
      return NextResponse.json({ error: 'action and urls are required' }, { status: 400 });
    }

    const resolvedPairs = await Promise.all(
      urls.map(async (url) => ({ url, objectKey: await resolveObjectKeyFromUrl(url) }))
    );
    const objectKeys = new Set(resolvedPairs.map((p) => p.objectKey).filter((k): k is string => Boolean(k)));

    if (action === 'move') {
      if (!folder) {
        return NextResponse.json({ error: 'folder is required for move' }, { status: 400 });
      }

      const nextTimestamp = Date.now();
      const publicMoved = await updateUploadRecordsByUrls(urls, (record) => ({
        ...record,
        folder,
        updatedAt: nextTimestamp,
      }), 'public');
      const plusMoved = await updateUploadRecordsByUrls(urls, (record) => ({
        ...record,
        folder,
        updatedAt: nextTimestamp,
      }), 'plus');

      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'bulk.move',
        actorIp: getClientIp(request),
        userAgent: getUserAgent(request),
        meta: { count: publicMoved + plusMoved, folder },
      });

      return NextResponse.json({ success: true, moved: publicMoved + plusMoved, folder });
    }

    if (action === 'delete' || action === 'expire') {
      for (const objectKey of objectKeys) {
        try {
          await deleteObject(objectKey);
        } catch (error) {
          console.error('Bulk delete failed:', objectKey, error);
        }
        await removeQuarantineRecord(objectKey);
      }

      const [publicHistory, plusHistory] = await Promise.all([
        loadUploadHistory('public'),
        loadUploadHistory('plus'),
      ]);

      const findUrlsToRemove = async (history: typeof publicHistory) => {
        const urls: string[] = [];
        await Promise.all(history.map(async (record) => {
          const objectKey = await resolveObjectKeyFromUrl(record.url);
          if (objectKey && objectKeys.has(objectKey)) urls.push(record.url);
        }));
        return urls;
      };

      const [publicUrlsToRemove, plusUrlsToRemove] = await Promise.all([
        findUrlsToRemove(publicHistory),
        findUrlsToRemove(plusHistory),
      ]);

      await Promise.all([
        removeUploadUrls(publicUrlsToRemove, 'public'),
        removeUploadUrls(plusUrlsToRemove, 'plus'),
      ]);

      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: action === 'expire' ? 'bulk.expire' : 'bulk.delete',
        actorIp: getClientIp(request),
        userAgent: getUserAgent(request),
        meta: { count: objectKeys.size },
      });

      return NextResponse.json({ success: true, removed: objectKeys.size });
    }

    if (action === 'quarantine') {
      for (const objectKey of objectKeys) {
        await upsertQuarantineRecord({
          objectKey,
          reason: reason || 'Admin quarantine',
          createdAt: Date.now(),
          createdByIp: getClientIp(request),
        });
      }

      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'bulk.quarantine',
        actorIp: getClientIp(request),
        userAgent: getUserAgent(request),
        meta: { count: objectKeys.size, reason: reason || undefined },
      });

      return NextResponse.json({ success: true, quarantined: objectKeys.size });
    }

    if (action === 'unquarantine') {
      let cleared = 0;
      for (const objectKey of objectKeys) {
        if (await removeQuarantineRecord(objectKey)) {
          cleared += 1;
        }
      }

      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'bulk.unquarantine',
        actorIp: getClientIp(request),
        userAgent: getUserAgent(request),
        meta: { count: cleared },
      });

      return NextResponse.json({ success: true, unquarantined: cleared });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Bulk admin error:', error);
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 500 });
  }
}
