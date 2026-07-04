import { NextRequest, NextResponse } from 'next/server';
import { loadAuditLog } from '@/app/lib/data/admin-audit-store';
import { requireAdmin } from '@/app/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const limit = Number(request.nextUrl.searchParams.get('limit'));
  const log = await loadAuditLog(Number.isFinite(limit) ? limit : 200);

  return NextResponse.json(
    { entries: log },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
