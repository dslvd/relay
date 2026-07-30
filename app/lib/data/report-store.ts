import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportAction = 'disabled' | 'deleted' | 'dismissed' | 'reopened';

export type AbuseReport = {
  id: string;
  timestamp: number;
  url: string;
  category: string;
  description: string;
  reporterEmail?: string;
  reporterIp?: string;
  status: ReportStatus;
  resolvedAt?: number;
  resolvedAction?: ReportAction;
  resolvedByIp?: string;
};

const REPORTS_KEY = 'admin:abuse-reports';
const MAX_REPORTS = 500;

function getGlobalReports(): AbuseReport[] {
  if (typeof global.adminAbuseReports === 'undefined') {
    global.adminAbuseReports = [];
  }
  return global.adminAbuseReports;
}

export async function loadAbuseReports(): Promise<AbuseReport[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(REPORTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as AbuseReport[];
    } catch {
      return [];
    }
  }

  return [...getGlobalReports()];
}

export async function saveAbuseReports(reports: AbuseReport[]): Promise<void> {
  const trimmed = reports.slice(0, MAX_REPORTS);
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(REPORTS_KEY, JSON.stringify(trimmed));
    return;
  }

  global.adminAbuseReports = trimmed;
}

export async function addAbuseReport(report: AbuseReport): Promise<void> {
  const reports = await loadAbuseReports();
  await saveAbuseReports([report, ...reports]);
}

export async function updateAbuseReportStatus(
  id: string,
  status: ReportStatus,
  details?: { action?: ReportAction; actorIp?: string }
): Promise<boolean> {
  const reports = await loadAbuseReports();
  const index = reports.findIndex((r) => r.id === id);
  if (index === -1) return false;

  reports[index] = {
    ...reports[index],
    status,
    resolvedAt: status === 'open' ? undefined : Date.now(),
    resolvedAction: status === 'open' ? undefined : details?.action,
    resolvedByIp: status === 'open' ? undefined : details?.actorIp,
  };
  await saveAbuseReports(reports);
  return true;
}

declare global {
  // eslint-disable-next-line no-var
  var adminAbuseReports: AbuseReport[] | undefined;
}
