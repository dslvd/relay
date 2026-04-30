import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';
import { normalizeObjectKey } from '@/app/lib/storage/r2-storage';

export type BlacklistRuleType = 'ip' | 'filename';

export type BlacklistRule = {
  id: string;
  type: BlacklistRuleType;
  pattern: string;
  createdAt: number;
  createdByIp?: string;
};

export type QuarantineRecord = {
  objectKey: string;
  reason?: string;
  createdAt: number;
  createdByIp?: string;
};

const BLACKLIST_KEY = 'admin:blacklist';
const QUARANTINE_KEY = 'admin:quarantine';
const MAX_RULES = 500;

function getGlobalBlacklist(): BlacklistRule[] {
  if (typeof global.adminBlacklist === 'undefined') {
    global.adminBlacklist = [];
  }
  return global.adminBlacklist;
}

function getGlobalQuarantine(): QuarantineRecord[] {
  if (typeof global.adminQuarantine === 'undefined') {
    global.adminQuarantine = [];
  }
  return global.adminQuarantine;
}

function safeRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  }
}

export async function loadBlacklistRules(): Promise<BlacklistRule[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(BLACKLIST_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as BlacklistRule[];
    } catch {
      return [];
    }
  }

  return [...getGlobalBlacklist()];
}

export async function saveBlacklistRules(rules: BlacklistRule[]): Promise<void> {
  const trimmed = rules.slice(0, MAX_RULES);
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(BLACKLIST_KEY, JSON.stringify(trimmed));
    return;
  }

  global.adminBlacklist = trimmed;
}

export async function addBlacklistRule(rule: BlacklistRule): Promise<void> {
  const rules = await loadBlacklistRules();
  await saveBlacklistRules([rule, ...rules]);
}

export async function removeBlacklistRule(ruleId: string): Promise<boolean> {
  const rules = await loadBlacklistRules();
  const next = rules.filter((rule) => rule.id !== ruleId);
  if (next.length === rules.length) {
    return false;
  }
  await saveBlacklistRules(next);
  return true;
}

export async function isBlacklisted(ip: string, filename?: string): Promise<boolean> {
  const rules = await loadBlacklistRules();
  if (!rules.length) return false;

  for (const rule of rules) {
    if (rule.type === 'ip' && ip) {
      if (safeRegex(rule.pattern).test(ip)) {
        return true;
      }
    }
    if (rule.type === 'filename' && filename) {
      if (safeRegex(rule.pattern).test(filename)) {
        return true;
      }
    }
  }

  return false;
}

export async function loadQuarantineRecords(): Promise<QuarantineRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(QUARANTINE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as QuarantineRecord[];
    } catch {
      return [];
    }
  }

  return [...getGlobalQuarantine()];
}

export async function saveQuarantineRecords(records: QuarantineRecord[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(QUARANTINE_KEY, JSON.stringify(records));
    return;
  }

  global.adminQuarantine = records;
}

export async function upsertQuarantineRecord(record: QuarantineRecord): Promise<void> {
  const normalizedKey = normalizeObjectKey(record.objectKey);
  const records = await loadQuarantineRecords();
  const next = records.filter((r) => r.objectKey !== normalizedKey);
  next.unshift({ ...record, objectKey: normalizedKey });
  await saveQuarantineRecords(next);
}

export async function removeQuarantineRecord(objectKey: string): Promise<boolean> {
  const normalizedKey = normalizeObjectKey(objectKey);
  const records = await loadQuarantineRecords();
  const next = records.filter((r) => r.objectKey !== normalizedKey);
  if (next.length === records.length) {
    return false;
  }
  await saveQuarantineRecords(next);
  return true;
}

export async function loadQuarantineMap(): Promise<Map<string, QuarantineRecord>> {
  const records = await loadQuarantineRecords();
  const map = new Map<string, QuarantineRecord>();
  for (const record of records) {
    map.set(record.objectKey, record);
  }
  return map;
}

export async function isQuarantined(objectKey: string): Promise<boolean> {
  const map = await loadQuarantineMap();
  return map.has(normalizeObjectKey(objectKey));
}

declare global {
  // eslint-disable-next-line no-var
  var adminBlacklist: BlacklistRule[] | undefined;
  // eslint-disable-next-line no-var
  var adminQuarantine: QuarantineRecord[] | undefined;
}
