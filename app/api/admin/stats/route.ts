import { NextRequest, NextResponse } from 'next/server';
import { listAllObjects } from '@/app/lib/storage/r2-storage';
import { cleanupAnalyticsData, loadAnalyticsData, saveAnalyticsData } from '@/app/lib/data/analytics-store';
import { loadCachedStorageStats, saveCachedStorageStats } from '@/app/lib/data/storage-stats-store';
import { requireAdmin } from '@/app/lib/auth/admin-auth';

const STORAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const STORAGE_CACHE_TTL_SECONDS = 5 * 60;

function getPricing(): { storagePerGbMonth: number; egressPerGb: number } {
  const storagePerGbMonth = Number(process.env.R2_STORAGE_USD_PER_GB_MONTH);
  const egressPerGb = Number(process.env.R2_EGRESS_USD_PER_GB);

  return {
    storagePerGbMonth: Number.isFinite(storagePerGbMonth) ? storagePerGbMonth : 0.015,
    egressPerGb: Number.isFinite(egressPerGb) ? egressPerGb : 0,
  };
}

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const cached = await loadCachedStorageStats(STORAGE_CACHE_TTL_MS);
  let storage = cached;

  if (!storage) {
    const objects = await listAllObjects('d/');
    const bytes = objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
    storage = {
      bytes,
      objects: objects.length,
      updatedAt: Date.now(),
    };
    await saveCachedStorageStats(storage, STORAGE_CACHE_TTL_SECONDS);
  }

  const analytics = cleanupAnalyticsData(await loadAnalyticsData());
  await saveAnalyticsData(analytics);

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const bytes24h = analytics.downloads
    .filter((e) => e.timestamp > dayAgo)
    .reduce((sum, e) => sum + (e.bytes || 0), 0);
  const bytes7days = analytics.downloads
    .filter((e) => e.timestamp > weekAgo)
    .reduce((sum, e) => sum + (e.bytes || 0), 0);

  const pricing = getPricing();
  const gb = storage.bytes / (1024 * 1024 * 1024);
  const storageMonthly = gb * pricing.storagePerGbMonth;
  const storageDaily = storageMonthly / 30;
  const storageWeekly = storageMonthly / 4.345;

  const bandwidth24h = (bytes24h / (1024 * 1024 * 1024)) * pricing.egressPerGb;
  const bandwidth7days = (bytes7days / (1024 * 1024 * 1024)) * pricing.egressPerGb;

  return NextResponse.json(
    {
      storage: {
        bytes: storage.bytes,
        objects: storage.objects,
        updatedAt: storage.updatedAt,
      },
      bandwidth: {
        bytes24h,
        bytes7days,
      },
      cost: {
        storageMonthly,
        storageWeekly,
        storageDaily,
        bandwidth24h,
        bandwidth7days,
        pricing,
      },
      cached: Boolean(cached),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
