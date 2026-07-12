import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, listAllObjects, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory, saveUploadHistory } from '@/app/lib/data/upload-history-store';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
import { removeQuarantineRecord, saveQuarantineRecords } from '@/app/lib/data/abuse-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { requireAdmin } from '@/app/lib/auth/admin-auth';

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

async function deleteAllBlobs(): Promise<number> {
  let deleted = 0;

  const objects = await listAllObjects('d/');
  for (const object of objects) {
    if (!object.Key) {
      continue;
    }

    try {
      await deleteObject(object.Key);
      deleted += 1;
    } catch (error) {
      console.error('Failed to delete object:', object.Key, error);
    }
  }

  return deleted;
}

export async function DELETE(request: NextRequest) {
  try {
    const authError = requireAdmin(request);
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const objectKey = toObjectKeyFromAppUrl(url);
    if (!objectKey) {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    const key = objectKey.startsWith('d/') ? objectKey.slice(2) : objectKey;
    const aliasTarget = await resolveAliasObjectKey(key);
    const targetKey = aliasTarget || objectKey;

    await deleteObject(targetKey);
    await removeQuarantineRecord(targetKey);

    const publicHistory = await loadUploadHistory('public');
    const plusHistory = await loadUploadHistory('plus');

    const resolveKey = async (recordUrl: string): Promise<string | null> => {
      const rawKey = toObjectKeyFromAppUrl(recordUrl);
      if (!rawKey) return null;
      const raw = rawKey.startsWith('d/') ? rawKey.slice(2) : rawKey;
      const resolved = await resolveAliasObjectKey(raw);
      return resolved || rawKey;
    };

    const publicFlags = await Promise.all(publicHistory.map(async (record) => {
      const key = await resolveKey(record.url);
      return key !== targetKey;
    }));
    const plusFlags = await Promise.all(plusHistory.map(async (record) => {
      const key = await resolveKey(record.url);
      return key !== targetKey;
    }));

    await saveUploadHistory(publicHistory.filter((_, idx) => publicFlags[idx]), 'public');
    await saveUploadHistory(plusHistory.filter((_, idx) => plusFlags[idx]), 'plus');

    await appendAuditLog({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      action: 'file.delete',
      actorIp: getClientIp(request),
      userAgent: getUserAgent(request),
      target: url,
    });

    return NextResponse.json({ 
      success: true,
      message: 'File deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAdmin(request);
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'clear_all') {
      const deleted = await deleteAllBlobs();
      await saveUploadHistory([], 'public');
      await saveUploadHistory([], 'plus');
      await saveQuarantineRecords([]);

      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'files.clear_all',
        actorIp: getClientIp(request),
        userAgent: getUserAgent(request),
        meta: { deleted },
      });

      return NextResponse.json({ 
        success: true,
        message: 'All files deleted successfully',
        deleted
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in admin operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform operation' },
      { status: 500 }
    );
  }
}
