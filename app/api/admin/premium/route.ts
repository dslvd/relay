import { NextRequest, NextResponse } from 'next/server';
import {
  PremiumInviteRecord,
  createPremiumInvite,
  deletePremiumUser,
  listPremiumInvites,
  listPremiumUsers,
  revokePremiumInvite,
} from '@/app/lib/auth/premium-auth';

const ADMIN_COOKIE_NAME = 'admin_auth';

function requireAdmin(request: NextRequest): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!cookieValue || cookieValue !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function sanitizeInviteForAdmin(invite: PremiumInviteRecord) {
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

  const usersList = await listPremiumUsers();
  const users = usersList.map((user) => ({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }));

  const invitesList = await listPremiumInvites();
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
    const invite = await createPremiumInvite(ttl);

    return NextResponse.json({
      success: true,
      invite: sanitizeInviteForAdmin(invite),
    });
  } catch (error) {
    console.error('Premium admin create invite error:', error);
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
      const removed = await revokePremiumInvite(String(id));
      return NextResponse.json({ success: removed });
    }

    if (type === 'user') {
      const removed = await deletePremiumUser(String(id));
      return NextResponse.json({ success: removed });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Premium admin delete error:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
