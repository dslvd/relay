import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export type AuditLogEntry = {
  id: string;
  timestamp: number;
  action: string;
  actorIp?: string;
  userAgent?: string;
  target?: string;
  meta?: Record<string, unknown>;
};

const AUDIT_KEY = 'admin:audit';
const MAX_AUDIT_ENTRIES = 500;

function getGlobalAuditLog(): AuditLogEntry[] {
  if (typeof global.adminAuditLog === 'undefined') {
    global.adminAuditLog = [];
  }
  return global.adminAuditLog;
}

export async function loadAuditLog(limit = MAX_AUDIT_ENTRIES): Promise<AuditLogEntry[]> {
  const cap = Math.max(1, Math.min(limit, MAX_AUDIT_ENTRIES));
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(AUDIT_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as AuditLogEntry[];
      return parsed.slice(0, cap);
    } catch {
      return [];
    }
  }

  return getGlobalAuditLog().slice(0, cap);
}

export async function saveAuditLog(entries: AuditLogEntry[]): Promise<void> {
  const trimmed = entries.slice(0, MAX_AUDIT_ENTRIES);
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(AUDIT_KEY, JSON.stringify(trimmed));
    return;
  }

  global.adminAuditLog = trimmed;
}

export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  const entries = await loadAuditLog(MAX_AUDIT_ENTRIES);
  const next = [entry, ...entries].slice(0, MAX_AUDIT_ENTRIES);
  await saveAuditLog(next);
}

declare global {
  // eslint-disable-next-line no-var
  var adminAuditLog: AuditLogEntry[] | undefined;
}
