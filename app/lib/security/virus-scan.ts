// Malware scanning via VirusTotal's file-hash lookup API. Reuses the SHA-256
// hash already computed client-side for the dedupe feature (see
// app/api/dedupe/route.ts), so this adds one fast API call at upload-commit
// time rather than re-fetching the object from R2 to hash it server-side.
//
// Trust note: because the hash comes from the client (same trust boundary the
// dedupe feature already accepts), a malicious client could in principle send
// a mismatched hash to dodge detection. This catches the common case —
// already-known malware — cheaply; it isn't a guarantee against a targeted
// bypass. A server-side re-hash (fetch object from R2, hash the stream) would
// close that gap at the cost of extra bandwidth/latency per upload.

const VT_LOOKUP_URL = 'https://www.virustotal.com/api/v3/files/';

export type ScanVerdict = {
  scanned: boolean;
  malicious: boolean;
  positives?: number;
  totalEngines?: number;
  reason?: string;
};

export function isVirusTotalConfigured(): boolean {
  return Boolean(process.env.VIRUSTOTAL_API_KEY);
}

/**
 * Looks up a file hash against VirusTotal's existing analysis database.
 * Returns `{ scanned: false }` if VT isn't configured, the hash hasn't been
 * seen before, or the lookup itself fails — callers should treat that as
 * "allow" (fail-open), not as a positive clean result.
 */
export async function checkFileHash(sha256: string): Promise<ScanVerdict> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return { scanned: false, malicious: false, reason: 'VirusTotal not configured' };
  }

  try {
    const res = await fetch(`${VT_LOOKUP_URL}${sha256}`, {
      headers: { 'x-apikey': apiKey },
    });

    if (res.status === 404) {
      // VT has never seen this exact file — most uploads will land here.
      return { scanned: false, malicious: false, reason: 'Hash not in VirusTotal database' };
    }

    if (!res.ok) {
      return { scanned: false, malicious: false, reason: `VirusTotal lookup failed (${res.status})` };
    }

    const payload = await res.json();
    const stats = payload?.data?.attributes?.last_analysis_stats;
    const malicious = Number(stats?.malicious) || 0;
    const suspicious = Number(stats?.suspicious) || 0;
    const totalEngines =
      malicious +
      suspicious +
      (Number(stats?.undetected) || 0) +
      (Number(stats?.harmless) || 0) +
      (Number(stats?.timeout) || 0);

    const positives = malicious + suspicious;

    return {
      scanned: true,
      malicious: positives > 0,
      positives,
      totalEngines,
    };
  } catch (error) {
    console.error('[virus-scan] VirusTotal lookup failed:', error);
    return { scanned: false, malicious: false, reason: 'VirusTotal lookup error' };
  }
}
