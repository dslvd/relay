import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, resolveObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory, removeUploadUrls } from '@/app/lib/data/upload-history-store';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
import { removeQuarantineRecord } from '@/app/lib/data/abuse-store';
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

    const targetKey = await resolveObjectKeyFromAppUrl(url);
    if (!targetKey) {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    await deleteObject(targetKey);
    await removeQuarantineRecord(targetKey);

    const publicHistory = await loadUploadHistory('public');
    const plusHistory = await loadUploadHistory('plus');

    const publicUrlsToRemove: string[] = [];
    await Promise.all(publicHistory.map(async (record) => {
      const key = await resolveObjectKeyFromAppUrl(record.url);
      if (key === targetKey) publicUrlsToRemove.push(record.url);
    }));
    const plusUrlsToRemove: string[] = [];
    await Promise.all(plusHistory.map(async (record) => {
      const key = await resolveObjectKeyFromAppUrl(record.url);
      if (key === targetKey) plusUrlsToRemove.push(record.url);
    }));

    await removeUploadUrls(publicUrlsToRemove, 'public');
    await removeUploadUrls(plusUrlsToRemove, 'plus');

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

