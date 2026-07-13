import { getSupabaseClient, hasSupabaseConfigured } from '@/app/lib/data/supabase-client';
import { incrementDownloadCount, getAllDownloadCounts, hasD1Configured } from '@/app/lib/data/d1-downloads';

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

interface DownloadRow {
  filename: string;
  file_key: string | null;
  timestamp: number;
  ip: string;
  user_agent: string | null;
  bytes: number | null;
  referer: string | null;
  country: string | null;
}

interface PageViewRow {
  path: string;
  timestamp: number;
  ip: string;
  referer: string | null;
  country: string | null;
  user_agent: string | null;
}

const ANALYTICS_LIMIT = 10_000;
const RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function downloadFromRow(row: DownloadRow): DownloadEvent {
  return {
    filename: row.filename,
    fileKey: row.file_key ?? undefined,
    timestamp: row.timestamp,
    ip: row.ip,
    userAgent: row.user_agent ?? 'Unknown',
    bytes: row.bytes ?? undefined,
    referer: row.referer ?? undefined,
    country: row.country ?? undefined,
  };
}

function pageViewFromRow(row: PageViewRow): PageView {
  return {
    path: row.path,
    timestamp: row.timestamp,
    ip: row.ip,
    referer: row.referer ?? undefined,
    country: row.country ?? undefined,
    userAgent: row.user_agent ?? undefined,
  };
}

function getGlobalStore(): AnalyticsData {
  if (typeof global.analyticsData === 'undefined') {
    global.analyticsData = { downloads: [], pageViews: [], totalDownloads: 0, downloadCounts: {} };
  }
  return global.analyticsData;
}

// Derives per-file counts from the (bounded) event list - used only as a
// fallback when D1 isn't configured for the durable, unbounded counter.
function downloadCountsFromEvents(downloads: DownloadEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of downloads) {
    const key = event.fileKey?.trim() || event.filename?.trim() || '';
    if (key) counts[key] = (counts[key] || 0) + 1;
    if (event.filename && event.filename !== key) {
      counts[event.filename] = (counts[event.filename] || 0) + 1;
    }
  }
  return counts;
}

export async function loadAnalyticsData(): Promise<AnalyticsData> {
  let downloadCounts: Record<string, number> = {};
  if (hasD1Configured()) {
    try {
      downloadCounts = await getAllDownloadCounts();
    } catch (error) {
      console.error('Failed to load download counts from D1:', error);
    }
  }

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const cutoff = Date.now() - RETENTION_WINDOW_MS;

    const [downloadsRes, pageViewsRes, countRes] = await Promise.all([
      supabase.from('analytics_downloads').select('*').gt('timestamp', cutoff).order('timestamp', { ascending: false }).limit(ANALYTICS_LIMIT),
      supabase.from('analytics_pageviews').select('*').gt('timestamp', cutoff).order('timestamp', { ascending: false }).limit(ANALYTICS_LIMIT),
      supabase.from('analytics_downloads').select('id', { count: 'exact', head: true }),
    ]);
    if (downloadsRes.error) throw downloadsRes.error;
    if (pageViewsRes.error) throw pageViewsRes.error;
    if (countRes.error) throw countRes.error;

    const downloads = (downloadsRes.data as DownloadRow[]).map(downloadFromRow).reverse();
    const pageViews = (pageViewsRes.data as PageViewRow[]).map(pageViewFromRow).reverse();

    return {
      downloads,
      pageViews,
      totalDownloads: countRes.count ?? downloads.length,
      downloadCounts: { ...downloadCountsFromEvents(downloads), ...downloadCounts },
    };
  }

  const data = getGlobalStore();
  return {
    ...data,
    downloadCounts: { ...downloadCountsFromEvents(data.downloads), ...downloadCounts },
  };
}

// No-op: retention is enforced at query time (loadAnalyticsData only reads
// the last 30 days / ANALYTICS_LIMIT rows) and there's no full blob to save
// back anymore. Kept so existing callers don't need restructuring.
export function cleanupAnalyticsData(data: AnalyticsData): AnalyticsData {
  return data;
}

export async function recordDownloadEvent(
  event: Omit<DownloadEvent, 'timestamp'> & { timestamp?: number }
): Promise<void> {
  const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
  const fileKey = event.fileKey?.trim() || '';
  const filename = event.filename?.trim() || '';
  const primaryKey = fileKey || filename;

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('analytics_downloads').insert({
      filename,
      file_key: fileKey || null,
      timestamp,
      ip: event.ip,
      user_agent: event.userAgent,
      bytes: event.bytes ?? null,
      referer: event.referer ?? null,
      country: event.country ?? null,
    });
    if (error) throw error;
  } else {
    const data = getGlobalStore();
    data.downloads = [...data.downloads, { ...event, filename, fileKey: fileKey || undefined, timestamp }].slice(-ANALYTICS_LIMIT);
    data.totalDownloads = (data.totalDownloads || 0) + 1;
  }

  if (hasD1Configured() && primaryKey) {
    try {
      await incrementDownloadCount(primaryKey, filename);
    } catch (error) {
      console.error('Failed to update D1 download count:', error);
    }
  }
}

export async function recordPageViewEvent(
  event: Omit<PageView, 'timestamp'> & { timestamp?: number }
): Promise<void> {
  const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('analytics_pageviews').insert({
      path: event.path,
      timestamp,
      ip: event.ip,
      referer: event.referer ?? null,
      country: event.country ?? null,
      user_agent: event.userAgent ?? null,
    });
    if (error) throw error;
    return;
  }

  const data = getGlobalStore();
  data.pageViews = [...data.pageViews, { ...event, timestamp }].slice(-ANALYTICS_LIMIT);
}

declare global {
  var analyticsData: AnalyticsData | undefined;
}
