import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory, saveUploadHistory, type UploadRecord } from '@/app/lib/data/upload-history-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
import { removeQuarantineRecord, upsertQuarantineRecord } from '@/app/lib/data/abuse-store';

const ADMIN_COOKIE_NAME = 'admin_auth';

type BulkAction = 'delete' | 'expire' | 'quarantine' | 'unquarantine';

function requireAdmin(request: NextRequest): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!cookieValue || cookieValue !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
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

async function resolveObjectKeyFromUrl(url: string): Promise<string | null> {
  const objectKey = toObjectKeyFromAppUrl(url);
  if (!objectKey) return null;
  const key = objectKey.startsWith('d/') ? objectKey.slice(2) : objectKey;
  const aliasTarget = await resolveAliasObjectKey(key);
  return aliasTarget || objectKey;
}

async function filterHistoryByObjectKeys(history: UploadRecord[], keysToRemove: Set<string>) {
  const keepFlags = await Promise.all(
    history.map(async (record) => {
      const objectKey = await resolveObjectKeyFromUrl(record.url);
      if (!objectKey) return true;
      return !keysToRemove.has(objectKey);
    })
  );
  return history.filter((_, index) => keepFlags[index]);
}

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action as BulkAction;
    const urls = Array.isArray(body?.urls) ? body.urls.filter((u: unknown) => typeof u === 'string') : [];
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

    if (!action || urls.length === 0) {
      return NextResponse.json({ error: 'action and urls are required' }, { status: 400 });
    }

    const resolvedPairs = await Promise.all(
      urls.map(async (url) => ({ url, objectKey: await resolveObjectKeyFromUrl(url) }))
    );
    const objectKeys = new Set(resolvedPairs.map((p) => p.objectKey).filter((k): k is string => Boolean(k)));

    if (action === 'delete' || action === 'expire') {
      for (const objectKey of objectKeys) {
        try {
          await deleteObject(objectKey);
        } catch (error) {
          console.error('Bulk delete failed:', objectKey, error);
        }
        await removeQuarantineRecord(objectKey);
      }

      const [publicHistory, premiumHistory] = await Promise.all([
        loadUploadHistory('public'),
        loadUploadHistory('premium'),
      ]);

      const [nextPublic, nextPremium] = await Promise.all([
        filterHistoryByObjectKeys(publicHistory, objectKeys),
        filterHistoryByObjectKeys(premiumHistory, objectKeys),
      ]);

      await Promise.all([
        saveUploadHistory(nextPublic, 'public'),
        saveUploadHistory(nextPremium, 'premium'),
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
