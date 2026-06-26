import fs from 'fs';
import path from 'path';
import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';
import { incrementDownloadCount, getDownloadCount, getAllDownloadCounts, hasD1Configured } from '@/app/lib/data/d1-downloads';

// File-based fallback so counts survive dev-server restarts and Vercel cold starts.
const FILE_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/relay-analytics.json'
  : path.join(process.cwd(), '.analytics-local.json');

function readFileStore(): AnalyticsData | null {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    return normalizeAnalyticsData(JSON.parse(raw) as Partial<AnalyticsData>);
  } catch {
    return null;
  }
}

function writeFileStore(data: AnalyticsData): void {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data));
  } catch (err) {
    console.error('[analytics] writeFileStore failed:', err);
  }
}

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
  // Load download counts from D1 if configured, otherwise from Redis/memory
  let downloadCounts: Record<string, number> = {};
  
  if (hasD1Configured()) {
    try {
      downloadCounts = await getAllDownloadCounts();
    } catch (error) {
      console.error('Failed to load download counts from D1:', error);
      downloadCounts = {};
    }
  }

  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(ANALYTICS_KEY);
    if (raw) {
      const data = normalizeAnalyticsData(JSON.parse(raw) as Partial<AnalyticsData>);
      // Merge D1 counts with Redis data
      return {
        ...data,
        downloadCounts: { ...data.downloadCounts, ...downloadCounts },
      };
    }

    return normalizeAnalyticsData({
      downloads: [],
      pageViews: [],
      totalDownloads: 0,
      downloadCounts,
    });
  }

  // File-based persistence (survives restarts when no Redis/D1).
  const fileData = readFileStore();
  if (fileData) {
    // Keep global in sync so subsequent in-process reads are fast.
    global.analyticsData = fileData;
    return normalizeAnalyticsData({
      ...fileData,
      downloadCounts: { ...fileData.downloadCounts, ...downloadCounts },
    });
  }

  const data = getGlobalAnalyticsData();
  return normalizeAnalyticsData({
    ...data,
    downloadCounts: { ...data.downloadCounts, ...downloadCounts },
  });
}

export async function saveAnalyticsData(data: AnalyticsData): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(ANALYTICS_KEY, JSON.stringify(data));
    return;
  }

  // Persist to file AND keep global for fast in-process reads.
  writeFileStore(data);
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

export async function recordDownloadEvent(
  data: AnalyticsData,
  event: Omit<DownloadEvent, 'timestamp'> & { timestamp?: number }
): Promise<AnalyticsData> {
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

  // Also increment count in D1 for persistent storage
  if (hasD1Configured() && primaryKey) {
    try {
      await incrementDownloadCount(primaryKey, filename);
    } catch (error) {
      console.error('Failed to update D1 download count:', error);
    }
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
