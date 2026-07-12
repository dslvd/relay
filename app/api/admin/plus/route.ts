import { NextRequest, NextResponse } from 'next/server';
import {
  PlusInviteRecord,
  createPlusInvite,
  deletePlusUser,
  listPlusInvites,
  listPlusUsers,
  revokePlusInvite,
} from '@/app/lib/auth/plus-auth';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
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

function sanitizeInviteForAdmin(invite: PlusInviteRecord) {
  return {
    id: invite.id,
    token: invite.token,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
    usedByUserId: invite.usedByUserId,
  };
}

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const usersList = await listPlusUsers();
  const users = usersList.map((user) => ({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }));

  const invitesList = await listPlusInvites();
  const invites = invitesList.map(sanitizeInviteForAdmin);

  return NextResponse.json({ users, invites });
}

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { action, ttlHours } = await request.json();

    if (action !== 'create_invite') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const ttl = Number.isFinite(Number(ttlHours)) ? Number(ttlHours) : 24;
    const invite = await createPlusInvite(ttl);

    await appendAuditLog({
      id: invite.id,
      timestamp: Date.now(),
      action: 'plus.invite.create',
      actorIp: getClientIp(request),
      userAgent: getUserAgent(request),
      target: invite.id,
      meta: { ttlHours: ttl },
    });

    return NextResponse.json({
      success: true,
      invite: sanitizeInviteForAdmin(invite),
    });
  } catch (error) {
    console.error('Plus admin create invite error:', error);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { type, id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (type === 'invite') {
      const removed = await revokePlusInvite(String(id));
      if (removed) {
        await appendAuditLog({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          action: 'plus.invite.revoke',
          actorIp: getClientIp(request),
          userAgent: getUserAgent(request),
          target: String(id),
        });
      }
      return NextResponse.json({ success: removed });
    }

    if (type === 'user') {
      const removed = await deletePlusUser(String(id));
      if (removed) {
        await appendAuditLog({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          action: 'plus.user.delete',
          actorIp: getClientIp(request),
          userAgent: getUserAgent(request),
          target: String(id),
        });
      }
      return NextResponse.json({ success: removed });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Plus admin delete error:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
