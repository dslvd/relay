import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { getPremiumUserFromSession } from '@/app/lib/premium-auth';
import { isExpired } from '@/app/lib/retention';
import { loadUploadHistory, saveUploadHistory } from '@/app/lib/upload-history-store';

const PREMIUM_COOKIE_NAME = 'premium_auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getPremiumUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const history = await loadUploadHistory('premium');
  const filtered = history.filter((record) => !isExpired(record.lastAccessTime));
  if (filtered.length !== history.length) {
    await saveUploadHistory(filtered, 'premium');
  }

  const userUploads = filtered
    .filter((record) => record.ownerId === user.id)
    .map(({ ownerId, ownerEmail, ...record }) => record)
    .sort((a, b) => b.timestamp - a.timestamp);

  return NextResponse.json({
    uploads: userUploads,
    count: userUploads.length,
  });
}

function toBlobStorageUrl(fileUrl: string): string {
  const parsed = new URL(fileUrl, 'http://localhost');
  const path = parsed.pathname;

  if (path.startsWith('/download/')) {
    return `https://rcltxppgseuupozb.public.blob.vercel-storage.com/d/${path.slice('/download/'.length)}`;
  }

  return `https://rcltxppgseuupozb.public.blob.vercel-storage.com${path}`;
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getPremiumUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const history = await loadUploadHistory('premium');
    const target = history.find((record) => record.url === url);

    if (!target) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    if (target.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const blobUrl = toBlobStorageUrl(url);
    await del(blobUrl);

    const updated = history.filter((record) => record.url !== url);
    await saveUploadHistory(updated, 'premium');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Premium upload delete error:', error);
    return NextResponse.json({ error: 'Failed to delete upload' }, { status: 500 });
  }
}
