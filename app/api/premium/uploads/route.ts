import { NextRequest, NextResponse } from 'next/server';
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

  const history = await loadUploadHistory();
  const filtered = history.filter((record) => !isExpired(record.lastAccessTime));
  if (filtered.length !== history.length) {
    await saveUploadHistory(filtered);
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
