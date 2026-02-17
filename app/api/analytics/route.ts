import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DownloadEvent {
  filename: string;
  timestamp: number;
  ip: string;
  userAgent: string;
}

interface PageView {
  path: string;
  timestamp: number;
  ip: string;
}

interface AnalyticsData {
  downloads: DownloadEvent[];
  pageViews: PageView[];
}

// Global storage (in production, use KV, Redis, or a database)
declare global {
  var analyticsData: AnalyticsData | undefined;
}

function getAnalyticsData(): AnalyticsData {
  if (!global.analyticsData) {
    global.analyticsData = {
      downloads: [],
      pageViews: []
    };
  }
  return global.analyticsData;
}

// Clean up old data (keep last 30 days)
function cleanupOldData() {
  const data = getAnalyticsData();
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  data.downloads = data.downloads.filter(d => d.timestamp > thirtyDaysAgo);
  data.pageViews = data.pageViews.filter(p => p.timestamp > thirtyDaysAgo);
}

// GET: Retrieve analytics data
export async function GET(request: NextRequest) {
  try {
    cleanupOldData();
    const data = getAnalyticsData();
    
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const last7days = now - (7 * 24 * 60 * 60 * 1000);
    
    // Calculate download statistics
    const downloadStats = data.downloads.reduce((acc, event) => {
      if (!acc[event.filename]) {
        acc[event.filename] = {
          filename: event.filename,
          totalDownloads: 0,
          last24h: 0,
          last7days: 0,
          uniqueIPs: new Set<string>()
        };
      }
      acc[event.filename].totalDownloads++;
      acc[event.filename].uniqueIPs.add(event.ip);
      if (event.timestamp > last24h) {
        acc[event.filename].last24h++;
      }
      if (event.timestamp > last7days) {
        acc[event.filename].last7days++;
      }
      return acc;
    }, {} as Record<string, any>);
    
    // Convert to array and sort by total downloads
    const topFiles = Object.values(downloadStats)
      .map((stat: any) => ({
        filename: stat.filename,
        totalDownloads: stat.totalDownloads,
        last24h: stat.last24h,
        last7days: stat.last7days,
        uniqueUsers: stat.uniqueIPs.size
      }))
      .sort((a, b) => b.totalDownloads - a.totalDownloads);
    
    // Page view statistics
    const totalPageViews = data.pageViews.length;
    const pageViews24h = data.pageViews.filter(p => p.timestamp > last24h).length;
    const pageViews7days = data.pageViews.filter(p => p.timestamp > last7days).length;
    
    // Unique visitors (by IP)
    const uniqueVisitors = new Set(data.pageViews.map(p => p.ip)).size;
    const uniqueVisitors24h = new Set(
      data.pageViews.filter(p => p.timestamp > last24h).map(p => p.ip)
    ).size;
    
    // Live visitors (last 5 minutes)
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const liveVisitors = new Set(
      data.pageViews.filter(p => p.timestamp > fiveMinutesAgo).map(p => p.ip)
    ).size;
    
    // Total downloads
    const totalDownloads = data.downloads.length;
    const downloads24h = data.downloads.filter(d => d.timestamp > last24h).length;
    const downloads7days = data.downloads.filter(d => d.timestamp > last7days).length;
    
    return NextResponse.json({
      pageViews: {
        total: totalPageViews,
        last24h: pageViews24h,
        last7days: pageViews7days
      },
      visitors: {
        unique: uniqueVisitors,
        unique24h: uniqueVisitors24h,
        live: liveVisitors
      },
      downloads: {
        total: totalDownloads,
        last24h: downloads24h,
        last7days: downloads7days
      },
      topFiles: topFiles.slice(0, 20),
      recentDownloads: data.downloads
        .slice(-50)
        .reverse()
        .map(d => ({
          filename: d.filename,
          timestamp: d.timestamp,
          ip: d.ip
        }))
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
    
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'Unknown';
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    
    const data = getAnalyticsData();
    
    if (type === 'download' && filename) {
      data.downloads.push({
        filename,
        timestamp: Date.now(),
        ip,
        userAgent
      });
    } else if (type === 'pageview' && path) {
      data.pageViews.push({
        path,
        timestamp: Date.now(),
        ip
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
