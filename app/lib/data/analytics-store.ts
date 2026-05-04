import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export interface DownloadEvent {
  filename: string;
  fileKey?: string;
  timestamp: number;
  ip: string;
  userAgent: string;
  bytes?: number;
  referer?: string;
  country?: string;
}

export interface PageView {
  path: string;
  timestamp: number;
  ip: string;
  referer?: string;
  country?: string;
  userAgent?: string;
}

export interface AnalyticsData {
  downloads: DownloadEvent[];
  pageViews: PageView[];
  totalDownloads: number;
  downloadCounts: Record<string, number>;
}

const ANALYTICS_KEY = 'analytics:data';
const ANALYTICS_LIMIT = 10_000;

function getGlobalAnalyticsData(): AnalyticsData {
  if (typeof global.analyticsData === 'undefined') {
    global.analyticsData = {
      downloads: [],
      pageViews: [],
      totalDownloads: 0,
      downloadCounts: {},
    };
  }

  return global.analyticsData;
}

function normalizeAnalyticsData(data: Partial<AnalyticsData>): AnalyticsData {
  const downloadCounts =
    data.downloadCounts && typeof data.downloadCounts === 'object'
      ? data.downloadCounts
      : {};

  const downloads = Array.isArray(data.downloads) ? data.downloads : [];
  const pageViews = Array.isArray(data.pageViews) ? data.pageViews : [];
  const totalDownloads =
    typeof data.totalDownloads === 'number'
      ? data.totalDownloads
      : downloads.length;

  return {
    downloads,
    pageViews,
    totalDownloads,
    downloadCounts,
  };
}

export async function loadAnalyticsData(): Promise<AnalyticsData> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(ANALYTICS_KEY);
    if (raw) {
      return normalizeAnalyticsData(JSON.parse(raw) as Partial<AnalyticsData>);
    }

    return normalizeAnalyticsData({
      downloads: [],
      pageViews: [],
      totalDownloads: 0,
      downloadCounts: {},
    });
  }

  return normalizeAnalyticsData(getGlobalAnalyticsData());
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
    totalDownloads: Number.isFinite(data.totalDownloads) ? data.totalDownloads : data.downloads.length,
    downloadCounts:
      data.downloadCounts && typeof data.downloadCounts === 'object'
        ? data.downloadCounts
        : {},
  };
}

export function recordDownloadEvent(
  data: AnalyticsData,
  event: Omit<DownloadEvent, 'timestamp'> & { timestamp?: number }
): AnalyticsData {
  const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
  const fileKey = event.fileKey?.trim() || '';
  const filename = event.filename?.trim() || '';
  
  // Use fileKey as primary aggregation key, fall back to filename
  const primaryKey = fileKey || filename;
  
  const downloads = [
    ...data.downloads,
    {
      ...event,
      timestamp,
    },
  ].slice(-ANALYTICS_LIMIT);

  // Store count under both fileKey and filename for flexible querying
  const newDownloadCounts = { ...data.downloadCounts };
  if (primaryKey) {
    newDownloadCounts[primaryKey] = (newDownloadCounts[primaryKey] || 0) + 1;
  }
  // Also store under filename alone for queries that only have filename
  if (filename && filename !== primaryKey) {
    newDownloadCounts[filename] = (newDownloadCounts[filename] || 0) + 1;
  }

  return {
    ...data,
    downloads,
    totalDownloads: (data.totalDownloads || 0) + 1,
    downloadCounts: newDownloadCounts,
  };
}

export function recordPageViewEvent(
  data: AnalyticsData,
  event: Omit<PageView, 'timestamp'> & { timestamp?: number }
): AnalyticsData {
  const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
  const pageViews = [
    ...data.pageViews,
    {
      ...event,
      timestamp,
    },
  ].slice(-ANALYTICS_LIMIT);

  return {
    ...data,
    pageViews,
  };
}

declare global {
  var analyticsData: AnalyticsData | undefined;
}
