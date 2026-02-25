import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupAnalyticsData,
  loadAnalyticsData,
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

// GET: Retrieve analytics data
export async function GET(request: NextRequest) {
  try {
    const data = cleanupAnalyticsData(await loadAnalyticsData());
    await saveAnalyticsData(data);

    const filenameFilter = request.nextUrl.searchParams.get('filename');

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7days = now - 7 * 24 * 60 * 60 * 1000;

    if (filenameFilter) {
      const fileDownloads = data.downloads.filter((event) => event.filename === filenameFilter);
      return NextResponse.json({
        filename: filenameFilter,
        totalDownloads: fileDownloads.length,
        last24h: fileDownloads.filter((event) => event.timestamp > last24h).length,
        last7days: fileDownloads.filter((event) => event.timestamp > last7days).length,
        uniqueUsers: new Set(fileDownloads.map((event) => event.ip)).size,
      });
    }

    // Calculate download statistics
    const downloadStats = data.downloads.reduce((acc, event) => {
      if (!acc[event.filename]) {
        acc[event.filename] = {
          filename: event.filename,
          totalDownloads: 0,
          last24h: 0,
          last7days: 0,
          uniqueIPs: new Set<string>(),
        };
      }

      acc[event.filename].totalDownloads += 1;
      acc[event.filename].uniqueIPs.add(event.ip);

      if (event.timestamp > last24h) {
        acc[event.filename].last24h += 1;
      }

      if (event.timestamp > last7days) {
        acc[event.filename].last7days += 1;
      }

      return acc;
    }, {} as Record<string, {
      filename: string;
      totalDownloads: number;
      last24h: number;
      last7days: number;
      uniqueIPs: Set<string>;
    }>);

    // Convert to array and sort by total downloads
    const topFiles = Object.values(downloadStats)
      .map((stat) => ({
        filename: stat.filename,
        totalDownloads: stat.totalDownloads,
        last24h: stat.last24h,
        last7days: stat.last7days,
        uniqueUsers: stat.uniqueIPs.size,
      }))
      .sort((a, b) => b.totalDownloads - a.totalDownloads);

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
    const totalDownloads = data.downloads.length;
    const downloads24h = data.downloads.filter((download) => download.timestamp > last24h).length;
    const downloads7days = data.downloads.filter((download) => download.timestamp > last7days).length;

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
      topFiles: topFiles.slice(0, 20),
      recentDownloads: data.downloads
        .slice(-50)
        .reverse()
        .map((download) => ({
          filename: download.filename,
          timestamp: download.timestamp,
          ip: download.ip,
        })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// POST: Track events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, filename, path } = body;

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    const data = cleanupAnalyticsData(await loadAnalyticsData());

    if (type === 'download' && filename) {
      data.downloads.push({
        filename,
        timestamp: Date.now(),
        ip,
        userAgent,
      });
    } else if (type === 'pageview' && path) {
      data.pageViews.push({
        path,
        timestamp: Date.now(),
        ip,
      });
    }

    await saveAnalyticsData(data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
