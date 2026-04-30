import { NextRequest, NextResponse } from 'next/server';
import { loadUploadHistory } from '@/app/lib/data/upload-history-store';
import { loadQuarantineMap } from '@/app/lib/data/abuse-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';

const ADMIN_COOKIE_NAME = 'admin_auth';

function requireAdmin(request: NextRequest): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!cookieValue || cookieValue !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

async function resolveObjectKeyFromUrl(url: string): Promise<string | null> {
  const objectKey = toObjectKeyFromAppUrl(url);
  if (!objectKey) return null;
  const key = objectKey.startsWith('d/') ? objectKey.slice(2) : objectKey;
  const aliasTarget = await resolveAliasObjectKey(key);
  return aliasTarget || objectKey;
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
