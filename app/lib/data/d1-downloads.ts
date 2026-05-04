/**
 * Cloudflare D1 Download Counter
 * Stores download counts in D1 database for persistent, reliable tracking
 */

interface D1Result {
  success: boolean;
  meta?: {
    duration: number;
  };
  results?: Array<any>;
  error?: string;
}

function hasD1Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_D1_DATABASE_ID &&
    process.env.CLOUDFLARE_API_TOKEN
  );
}

async function queryD1(query: string, params?: any[]): Promise<D1Result> {
  if (!hasD1Configured()) {
    return { success: false, error: 'D1 not configured' };
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: query,
          params: params || [],
        }),
      }
    );

    const data = await response.json();
    if (!data.success) {
      console.error('D1 Query Error:', data.errors);
      return { success: false, error: data.errors?.[0] || 'Unknown error' };
    }

    return data.result?.[0] || { success: false };
  } catch (error) {
    console.error('D1 Connection Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}

export async function initializeDownloadCountTable(): Promise<boolean> {
  if (!hasD1Configured()) return false;

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS download_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_key TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0,
      last_updated INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `;

  const result = await queryD1(createTableQuery);
  return result.success !== false;
}

export async function incrementDownloadCount(fileKey: string, filename: string): Promise<number> {
  if (!hasD1Configured()) return 0;

  const now = Date.now();
  
  // Try to increment existing record, or insert if doesn't exist
  const upsertQuery = `
    INSERT INTO download_counts (file_key, file_name, download_count, last_updated, created_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(file_key) DO UPDATE SET
      download_count = download_count + 1,
      last_updated = ?
    RETURNING download_count
  `;

  const result = await queryD1(upsertQuery, [fileKey, filename, now, now, now]);
  
  if (result.success && result.results?.[0]) {
    return result.results[0].download_count || 0;
  }

  return 0;
}

export async function getDownloadCount(fileKey: string, filename?: string): Promise<number> {
  if (!hasD1Configured()) return 0;

  let query: string;
  let params: string[];

  if (fileKey) {
    query = 'SELECT download_count FROM download_counts WHERE file_key = ? LIMIT 1';
    params = [fileKey];
  } else if (filename) {
    query = 'SELECT download_count FROM download_counts WHERE file_name = ? LIMIT 1';
    params = [filename];
  } else {
    return 0;
  }

  const result = await queryD1(query, params);

  if (result.success && result.results?.[0]) {
    return result.results[0].download_count || 0;
  }

  return 0;
}

export async function getAllDownloadCounts(): Promise<Record<string, number>> {
  if (!hasD1Configured()) return {};

  const query = 'SELECT file_key, download_count FROM download_counts';
  const result = await queryD1(query);

  if (!result.success || !result.results) return {};

  const counts: Record<string, number> = {};
  for (const row of result.results) {
    if (row.file_key) {
      counts[row.file_key] = row.download_count || 0;
    }
  }

  return counts;
}

export async function bulkUpdateDownloadCounts(counts: Record<string, number>): Promise<boolean> {
  if (!hasD1Configured()) return false;

  const now = Date.now();
  const values = Object.entries(counts)
    .map(([fileKey, count]) => `('${fileKey.replace(/'/g, "''")}', ${count}, ${now}, ${now})`)
    .join(',');

  const query = `
    INSERT INTO download_counts (file_key, file_name, download_count, last_updated, created_at)
    VALUES ${values}
    ON CONFLICT(file_key) DO UPDATE SET
      download_count = excluded.download_count,
      last_updated = excluded.last_updated
  `;

  const result = await queryD1(query);
  return result.success !== false;
}

export { hasD1Configured };
