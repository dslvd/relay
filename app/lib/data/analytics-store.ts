import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export interface DownloadEvent {
  filename: string;
  timestamp: number;
  ip: string;
  userAgent: string;
}

export interface PageView {
  path: string;
  timestamp: number;
  ip: string;
}

export interface AnalyticsData {
  downloads: DownloadEvent[];
  pageViews: PageView[];
}

const ANALYTICS_KEY = 'analytics:data';
const ANALYTICS_LIMIT = 10_000;

function getGlobalAnalyticsData(): AnalyticsData {
  if (typeof global.analyticsData === 'undefined') {
    global.analyticsData = {
      downloads: [],
      pageViews: [],
    };
  }

  return global.analyticsData;
}

export async function loadAnalyticsData(): Promise<AnalyticsData> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(ANALYTICS_KEY);
    if (raw) {
      return JSON.parse(raw) as AnalyticsData;
    }

    return {
      downloads: [],
      pageViews: [],
    };
  }

  return getGlobalAnalyticsData();
}

export async function saveAnalyticsData(data: AnalyticsData): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(ANALYTICS_KEY, JSON.stringify(data));
    return;
  }

  global.analyticsData = data;
}

export function cleanupAnalyticsData(data: AnalyticsData, now = Date.now()): AnalyticsData {
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  return {
    downloads: data.downloads
      .filter((event) => event.timestamp > thirtyDaysAgo)
      .slice(-ANALYTICS_LIMIT),
    pageViews: data.pageViews
      .filter((event) => event.timestamp > thirtyDaysAgo)
      .slice(-ANALYTICS_LIMIT),
  };
}

declare global {
  var analyticsData: AnalyticsData | undefined;
}
