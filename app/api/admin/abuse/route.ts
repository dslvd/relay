import { NextRequest, NextResponse } from 'next/server';
import {
  addBlacklistRule,
  loadBlacklistRules,
  loadQuarantineRecords,
  removeBlacklistRule,
  type BlacklistRule,
} from '@/app/lib/data/abuse-store';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';

const ADMIN_COOKIE_NAME = 'admin_auth';

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

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const [blacklist, quarantine] = await Promise.all([
    loadBlacklistRules(),
    loadQuarantineRecords(),
  ]);

  return NextResponse.json(
    { blacklist, quarantine },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const type = body?.type === 'ip' || body?.type === 'filename' ? body.type : null;
    const pattern = typeof body?.pattern === 'string' ? body.pattern.trim() : '';

    if (!type || !pattern) {
      return NextResponse.json({ error: 'type and pattern are required' }, { status: 400 });
    }

    if (pattern.length > 200) {
      return NextResponse.json({ error: 'pattern is too long' }, { status: 400 });
    }

    const rule: BlacklistRule = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      pattern,
      createdAt: Date.now(),
      createdByIp: getClientIp(request),
    };

    await addBlacklistRule(rule);
    await appendAuditLog({
      id: rule.id,
      timestamp: Date.now(),
      action: 'blacklist.add',
      actorIp: getClientIp(request),
      userAgent: getUserAgent(request),
      target: pattern,
      meta: { type },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error('Blacklist add error:', error);
    return NextResponse.json({ error: 'Failed to add blacklist rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const removed = await removeBlacklistRule(id);
    if (!removed) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await appendAuditLog({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      action: 'blacklist.remove',
      actorIp: getClientIp(request),
      userAgent: getUserAgent(request),
      target: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blacklist delete error:', error);
    return NextResponse.json({ error: 'Failed to delete blacklist rule' }, { status: 500 });
  }
}
