import { describe, expect, it } from 'vitest';
import {
  addUploadRecord,
  loadUploadHistory,
  removeUploadUrls,
  touchLastAccessTime,
  updateUploadRecordByUrl,
  updateUploadRecordsByUrls,
  type UploadRecord,
} from './upload-history-store';

// Exercises the in-memory fallback path (no SUPABASE_URL in the test
// environment) - the Supabase-backed path is verified against a real
// project once SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are configured.
function makeRecord(overrides: Partial<UploadRecord> = {}): UploadRecord {
  const now = Date.now();
  return {
    url: `https://example.com/d/${crypto.randomUUID()}`,
    filename: 'test.txt',
    timestamp: now,
    lastAccessTime: now,
    expiresAt: now + 1000 * 60 * 60,
    size: 1234,
    ...overrides,
  };
}

describe('upload-history-store', () => {
  it('adds a record and finds it in loadUploadHistory', async () => {
    const record = makeRecord();
    await addUploadRecord(record, 'public');

    const history = await loadUploadHistory('public');
    expect(history.some((r) => r.url === record.url)).toBe(true);
  });

  it('keeps scopes separate', async () => {
    const record = makeRecord();
    await addUploadRecord(record, 'plus');

    const publicHistory = await loadUploadHistory('public');
    expect(publicHistory.some((r) => r.url === record.url)).toBe(false);

    const plusHistory = await loadUploadHistory('plus');
    expect(plusHistory.some((r) => r.url === record.url)).toBe(true);
  });

  it('removeUploadUrls deletes only the targeted url', async () => {
    const keep = makeRecord();
    const remove = makeRecord();
    await addUploadRecord(keep, 'public');
    await addUploadRecord(remove, 'public');

    const removedCount = await removeUploadUrls([remove.url], 'public');
    expect(removedCount).toBe(1);

    const history = await loadUploadHistory('public');
    expect(history.some((r) => r.url === remove.url)).toBe(false);
    expect(history.some((r) => r.url === keep.url)).toBe(true);
  });

  it('updateUploadRecordByUrl applies the transform to only that record', async () => {
    const record = makeRecord({ folder: undefined });
    await addUploadRecord(record, 'public');

    const updated = await updateUploadRecordByUrl(
      record.url,
      (current) => ({ ...current, folder: 'folder-abc' }),
      'public'
    );

    expect(updated?.folder).toBe('folder-abc');

    const history = await loadUploadHistory('public');
    const persisted = history.find((r) => r.url === record.url);
    expect(persisted?.folder).toBe('folder-abc');
  });

  it('updateUploadRecordsByUrls updates every matching record and reports the count', async () => {
    const a = makeRecord();
    const b = makeRecord();
    const untouched = makeRecord();
    await addUploadRecord(a, 'public');
    await addUploadRecord(b, 'public');
    await addUploadRecord(untouched, 'public');

    const count = await updateUploadRecordsByUrls(
      [a.url, b.url],
      (current) => ({ ...current, favorite: true }),
      'public'
    );
    expect(count).toBe(2);

    const history = await loadUploadHistory('public');
    expect(history.find((r) => r.url === a.url)?.favorite).toBe(true);
    expect(history.find((r) => r.url === b.url)?.favorite).toBe(true);
    expect(history.find((r) => r.url === untouched.url)?.favorite).toBeFalsy();
  });

  it('touchLastAccessTime bumps lastAccessTime for an exact url match', async () => {
    const record = makeRecord({ lastAccessTime: Date.now() - 100_000 });
    await addUploadRecord(record, 'public');

    const before = Date.now();
    await touchLastAccessTime(record.url);

    const history = await loadUploadHistory('public');
    const persisted = history.find((r) => r.url === record.url);
    expect(persisted?.lastAccessTime).toBeGreaterThanOrEqual(before);
  });
});
