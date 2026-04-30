import { NextRequest, NextResponse } from 'next/server';
import { loadAuditLog } from '@/app/lib/data/admin-audit-store';

const ADMIN_COOKIE_NAME = 'admin_auth';

function requireAdmin(request: NextRequest): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!cookieValue || cookieValue !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

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
