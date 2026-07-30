import { NextRequest, NextResponse } from 'next/server';
import { loadAbuseReports, updateAbuseReportStatus, type ReportStatus } from '@/app/lib/data/report-store';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
import { requireAdmin } from '@/app/lib/auth/admin-auth';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const reports = await loadAbuseReports();
  return NextResponse.json(
    { reports },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

const VALID_STATUSES = new Set<ReportStatus>(['open', 'resolved', 'dismissed']);

export async function PATCH(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const status = body?.status as ReportStatus;

    if (!id || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
    }

    const updated = await updateAbuseReportStatus(id, status);
    if (!updated) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    await appendAuditLog({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      action: 'abuse.report.status_changed',
      actorIp: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
      target: id,
      meta: { status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report status update error:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}
