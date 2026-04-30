import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'Unknown';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Get password from environment variable (defaults to 'admin123' if not set)
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

    if (password === adminPassword) {
      const response = NextResponse.json({
        success: true,
        message: 'Authentication successful'
      });

      response.cookies.set({
        name: 'admin_auth',
        value: adminPassword,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });

      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'admin.login.success',
        actorIp: ip,
        userAgent,
      });

      return response;
    } else {
      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'admin.login.failed',
        actorIp: ip,
        userAgent,
      });
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, message: 'Authentication failed' },
      { status: 500 }
    );
  }
}
