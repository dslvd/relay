import { NextResponse } from 'next/server';
import { checkPremiumStorageHealth } from '@/app/lib/premium-auth';

export async function GET() {
  const status = await checkPremiumStorageHealth();
  return NextResponse.json(status, { status: status.ok ? 200 : 500 });
}
