import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupAnalyticsData,
  loadAnalyticsData,
  recordDownloadEvent,
  recordPageViewEvent,
  saveAnalyticsData,
} from '@/app/lib/data/analytics-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

function getCountry(request: NextRequest): string | undefined {
  const fromVercel = request.headers.get('x-vercel-ip-country');
  const fromCf = request.headers.get('cf-ipcountry');
  const value = (fromVercel || fromCf || '').trim();
  return value ? value : undefined;
}

function normalizeReferer(value: string | null): string | undefined {
  const ref = (value || '').trim();
  if (!ref) return undefined;
  // Avoid extremely long values.
  return ref.slice(0, 500);
}

// GET: Retrieve analytics data
export async function GET(request: NextRequest) {
  try {
    const data = cleanupAnalyticsData(await loadAnalyticsData());
    await saveAnalyticsData(data);

    const fileKeyFilter = request.nextUrl.searchParams.get('key')?.trim() || '';
    const filenameFilter = request.nextUrl.searchParams.get('filename')?.trim() || '';
    const detail = request.nextUrl.searchParams.get('detail') === '1';

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7days = now - 7 * 24 * 60 * 60 * 1000;

    const selectedKey = fileKeyFilter || filenameFilter;
    if (selectedKey) {
      // Try to find downloads by fileKey first, then by filename
      const fileDownloads = data.downloads.filter(
        (event) => {
          const eventFileKey = event.fileKey?.trim() || '';
          const eventFilename = event.filename?.trim() || '';
          return eventFileKey === selectedKey || eventFilename === selectedKey || eventFileKey === fileKeyFilter || eventFilename === filenameFilter;
        }
      );
      
      // Get the total count with multiple fallbacks
      let totalDownloads: number | undefined = undefined;
      
      // First try exact key match
      if (data.downloadCounts[selectedKey] !== undefined) {
        totalDownloads = data.downloadCounts[selectedKey];
      }
      
      // Try fileKey filter
      if (totalDownloads === undefined && fileKeyFilter && data.downloadCounts[fileKeyFilter] !== undefined) {
        totalDownloads = data.downloadCounts[fileKeyFilter];
      }
      
      // Try filename filter
      if (totalDownloads === undefined && filenameFilter && data.downloadCounts[filenameFilter] !== undefined) {
        totalDownloads = data.downloadCounts[filenameFilter];
      }
      
      // Fallback: count from the downloads array
      if (totalDownloads === undefined) {
        totalDownloads = fileDownloads.length;
      }
      
      return NextResponse.json({
        key: selectedKey,
        filename: filenameFilter || selectedKey,
        totalDownloads: totalDownloads || 0,
        last24h: fileDownloads.filter((event) => event.timestamp > last24h).length,
        last7days: fileDownloads.filter((event) => event.timestamp > last7days).length,
        uniqueUsers: new Set(fileDownloads.map((event) => event.ip)).size,
        bytesTotal: fileDownloads.reduce((acc, e) => acc + (e.bytes || 0), 0),
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
        }
      });
    }

    // Build per-file recent-window stats from bounded event history.
    const recentDownloadStats = data.downloads.reduce((acc, event) => {
      if (!acc[event.filename]) {
        acc[event.filename] = {
          last24h: 0,
          last7days: 0,
          uniqueIPs: new Set<string>(),
        };
      }

      acc[event.filename].uniqueIPs.add(event.ip);

      if (event.timestamp > last24h) {
        acc[event.filename].last24h += 1;
      }

      if (event.timestamp > last7days) {
        acc[event.filename].last7days += 1;
      }

      return acc;
    }, {} as Record<string, {
      last24h: number;
      last7days: number;
      uniqueIPs: Set<string>;
    }>);

    // Use compact aggregate counts for all-time totals and combine with recent windows.
    const topFiles = Object.entries(data.downloadCounts)
      .map(([filename, totalDownloads]) => {
        const recent = recentDownloadStats[filename];
        return {
          filename,
          totalDownloads,
          last24h: recent?.last24h || 0,
          last7days: recent?.last7days || 0,
          uniqueUsers: recent?.uniqueIPs.size || 0,
        };
      })
      .sort((a, b) => b.totalDownloads - a.totalDownloads);

    // Include recently seen files even if legacy aggregates are missing.
    for (const [filename, recent] of Object.entries(recentDownloadStats)) {
      if (data.downloadCounts[filename]) continue;
      topFiles.push({
        filename,
        totalDownloads: 0,
        last24h: recent.last24h,
        last7days: recent.last7days,
        uniqueUsers: recent.uniqueIPs.size,
      });
    }

    // Page view statistics
    const totalPageViews = data.pageViews.length;
    const pageViews24h = data.pageViews.filter((view) => view.timestamp > last24h).length;
    const pageViews7days = data.pageViews.filter((view) => view.timestamp > last7days).length;

    // Unique visitors (by IP)
    const uniqueVisitors = new Set(data.pageViews.map((view) => view.ip)).size;
    const uniqueVisitors24h = new Set(
      data.pageViews.filter((view) => view.timestamp > last24h).map((view) => view.ip)
    ).size;

    // Live visitors (last 5 minutes)
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const liveVisitors = new Set(
      data.pageViews.filter((view) => view.timestamp > fiveMinutesAgo).map((view) => view.ip)
    ).size;

    // Total downloads
    const totalDownloads = data.totalDownloads || data.downloads.length;
    const downloads24h = data.downloads.filter((download) => download.timestamp > last24h).length;
    const downloads7days = data.downloads.filter((download) => download.timestamp > last7days).length;

    const totalBytes = data.downloads.reduce((acc, e) => acc + (e.bytes || 0), 0);
    const bytes24h = data.downloads
      .filter((e) => e.timestamp > last24h)
      .reduce((acc, e) => acc + (e.bytes || 0), 0);
    const bytes7days = data.downloads
      .filter((e) => e.timestamp > last7days)
      .reduce((acc, e) => acc + (e.bytes || 0), 0);

    const topReferrers = (() => {
      const counts = new Map<string, number>();
      for (const e of data.downloads) {
        const ref = (e.referer || '').trim();
        if (!ref) continue;
        counts.set(ref, (counts.get(ref) || 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([referer, count]) => ({ referer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
    })();

    const topCountries = (() => {
      const counts = new Map<string, number>();
      for (const e of data.downloads) {
        const c = (e.country || '').trim();
        if (!c) continue;
        counts.set(c, (counts.get(c) || 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
    })();

    const series = (() => {
      if (!detail) return null;
      // Hourly buckets for last 24h.
      const hourMs = 60 * 60 * 1000;
      const start = now - 24 * hourMs;
      const buckets = new Map<number, { ts: number; downloads: number; bytes: number; pageViews: number }>();
      for (let t = start - (start % hourMs); t <= now; t += hourMs) {
        buckets.set(t, { ts: t, downloads: 0, bytes: 0, pageViews: 0 });
      }
      for (const d of data.downloads) {
        if (d.timestamp < start) continue;
        const b = buckets.get(d.timestamp - (d.timestamp % hourMs));
        if (!b) continue;
        b.downloads += 1;
        b.bytes += d.bytes || 0;
      }
      for (const v of data.pageViews) {
        if (v.timestamp < start) continue;
        const b = buckets.get(v.timestamp - (v.timestamp % hourMs));
        if (!b) continue;
        b.pageViews += 1;
      }
      return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
    })();

    return NextResponse.json({
      pageViews: {
        total: totalPageViews,
        last24h: pageViews24h,
        last7days: pageViews7days,
      },
      visitors: {
        unique: uniqueVisitors,
        unique24h: uniqueVisitors24h,
        live: liveVisitors,
      },
      downloads: {
        total: totalDownloads,
        last24h: downloads24h,
        last7days: downloads7days,
      },
      bandwidth: {
        totalBytes,
        last24h: bytes24h,
        last7days: bytes7days,
      },
      topFiles: topFiles.slice(0, 20),
      topReferrers,
      topCountries,
      series,
      recentDownloads: data.downloads
        .slice(-50)
        .reverse()
        .map((download) => ({
          filename: download.filename,
          timestamp: download.timestamp,
          ip: download.ip,
        })),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      }
    });
  }
}

// POST: Track events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, filename, path, bytes } = body;

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const referer = normalizeReferer(request.headers.get('referer'));
    const country = getCountry(request);

    let data = cleanupAnalyticsData(await loadAnalyticsData());

    if (type === 'download' && filename) {
      data = await recordDownloadEvent(data, {
        filename,
        fileKey: typeof body?.fileKey === 'string' && body.fileKey.trim() ? body.fileKey.trim() : undefined,
        ip,
        userAgent,
        bytes: Number.isFinite(Number(bytes)) ? Number(bytes) : undefined,
        referer,
        country,
      });
    } else if (type === 'pageview' && path) {
      data = recordPageViewEvent(data, {
        path,
        ip,
        referer,
        country,
        userAgent,
      });
    }

    await saveAnalyticsData(data);

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      }
    });
  }
}
