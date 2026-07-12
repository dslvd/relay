import { NextRequest, NextResponse } from 'next/server';
import { getPlusUserFromSession } from '@/app/lib/auth/plus-auth';
import { isExpired } from '@/app/lib/storage/retention';
import { loadUploadHistory, removeUploadUrls } from '@/app/lib/data/upload-history-store';
import { deleteObject, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';

const PLUS_COOKIE_NAME = 'plus_auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getPlusUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Missing-object cleanup runs on the daily cron (app/api/cron/cleanup) and
  // on explicit delete - not here, since force-checking every file against
  // R2 on every page load/poll was both expensive and, prior to the safer
  // objectExists() error handling, capable of wiping valid entries on a
  // single transient R2 error.
  // Expired-entry cleanup runs on the daily cron - just filter for display here.
  const history = await loadUploadHistory('plus');
  const filtered = history.filter((record) => !isExpired(record.lastAccessTime));

  const userUploads = filtered
    .filter((record) => record.ownerId === user.id)
    .map(({ ownerId, ownerEmail, ...record }) => record)
    .sort((a, b) => b.timestamp - a.timestamp);

  return NextResponse.json({
    uploads: userUploads,
    count: userUploads.length,
  });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getPlusUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const history = await loadUploadHistory('plus');
    const target = history.find((record) => record.url === url);

    if (!target) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    if (target.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const objectKey = toObjectKeyFromAppUrl(url);
    if (!objectKey) {
      return NextResponse.json({ error: 'Invalid upload URL' }, { status: 400 });
    }

    await deleteObject(objectKey);
    await removeUploadUrls([url], 'plus');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Plus upload delete error:', error);
    return NextResponse.json({ error: 'Failed to delete upload' }, { status: 500 });
  }
}
