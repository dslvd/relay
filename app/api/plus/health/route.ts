import { NextResponse } from 'next/server';
import { checkPlusStorageHealth } from '@/app/lib/auth/plus-auth';

export async function GET() {
  const status = await checkPlusStorageHealth();
  return NextResponse.json(status, { status: status.ok ? 200 : 500 });
}
