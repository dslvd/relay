/**
 * TypeScript/JavaScript Client Library for the Relay file API
 *
 * Targets /api/files/* (see /docs on your deployment). The older
 * /api/v1/* surface this client used to call is deprecated - see
 * app/lib/auth/api-auth.ts's withDeprecatedApiAuth.
 *
 * Usage:
 * ```typescript
 * import { VBlobCDN } from './vblob-cdn-client';
 *
 * const cdn = new VBlobCDN('your-api-key', 'https://your-domain.com');
 *
 * const result = await cdn.upload(file);
 * console.log('Download URL:', result.url);
 *
 * const { data: files } = await cdn.listFiles({ q: 'invoice' });
 * const info = await cdn.getFileInfo(result.shortId);
 * await cdn.deleteFile(result.id);
 * ```
 *
 * Files above a few MB should use the multipart endpoints
 * (/api/files/multipart/init, batch-urls, complete, abort) documented at
 * /docs - this lightweight client only covers the single-shot upload path.
 */

export interface VBlobCDNConfig {
  apiKey?: string;
  baseUrl: string;
  timeout?: number;
}

export interface UploadResult {
  id: string;
  name: string;
  size: number;
  url: string;
  viewUrl?: string;
  mimeType: string;
  createdAt: string;
  isAnonymous: boolean;
  expiresAt: string | null;
  shortId: string;
}

export interface FileRecord {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  path: string;
  short_id: string;
  folder_id: string | null;
  owner_id: string | null;
  is_anonymous: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  download_count: number;
}

export interface ListFilesOptions {
  page?: number;
  limit?: number;
  folderId?: string | null;
  includeFolders?: boolean;
  /** Case-insensitive substring match on filename. */
  q?: string;
  /** Prefix match on MIME type, e.g. "image/". */
  mimeType?: string;
}

export interface ListFilesResult {
  data: FileRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  folders?: Array<{ id: string; name: string; parent_id: null; owner_id: null; created_at: string; updated_at: string }>;
}

export interface FileInfoResult {
  status: number;
  filecode: string;
  name?: string;
  size?: string;
  uploaded?: string;
  download?: string;
  status_field?: string;
}

export interface DownloadUrlResult {
  url: string;
  fileName: string;
  size: number;
  mimeType: string;
  expiresIn: number;
  expiresAt: string | null;
  downloads: number;
  shortId: string;
}

export interface BatchDeleteResult {
  results: Array<{ fileId: string; success: boolean; error?: string }>;
  deletedCount: number;
}

export class VBlobCDNError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'VBlobCDNError';
  }
}

export class VBlobCDN {
  private apiKey?: string;
  private baseUrl: string;
  private timeout: number;

  constructor(apiKey: string | undefined, baseUrl: string, timeout: number = 30000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { ...this.authHeaders(), ...options.headers },
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new VBlobCDNError(data.error || 'Request failed', response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof VBlobCDNError) throw error;
      if (error instanceof Error) throw new VBlobCDNError(error.message);
      throw new VBlobCDNError('Unknown error occurred');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Upload a file. Anonymous (no API key) uploads are capped at 25GB and
   * expire after 15 days; key-owned uploads are capped by the key's
   * rateLimit.uploadSizeLimit and total storage quota.
   */
  async upload(file: File | Blob, filename?: string, folderId?: string): Promise<UploadResult> {
    const form = new FormData();
    const name = filename || (file instanceof File ? file.name : 'file');
    form.append('file', file, name);
    if (folderId) form.append('folderId', folderId);

    const result = await this.request<{ success: true; data: UploadResult }>('/api/files/upload', {
      method: 'POST',
      body: form,
    });
    return result.data;
  }

  /** Have the server fetch a URL and store it. Same limits as upload(). */
  async remoteUpload(url: string, folderId?: string): Promise<UploadResult> {
    const result = await this.request<{ success: true; data: UploadResult }>('/api/files/remote-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, folderId }),
    });
    return result.data;
  }

  /** List files uploaded with this API key. Requires the "list" permission. */
  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.folderId !== undefined) params.set('folderId', options.folderId === null ? 'null' : options.folderId);
    if (options.includeFolders !== undefined) params.set('includeFolders', String(options.includeFolders));
    if (options.q) params.set('q', options.q);
    if (options.mimeType) params.set('mimeType', options.mimeType);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ListFilesResult>(`/api/files/list${query}`);
  }

  /**
   * Look up one or more files by their short ID (public - no API key
   * needed). Accepts a single ID or an array for a batch lookup.
   */
  async getFileInfo(shortIdOrIds: string | string[]): Promise<FileInfoResult[]> {
    const codes = Array.isArray(shortIdOrIds) ? shortIdOrIds.join(',') : shortIdOrIds;
    const result = await this.request<{ result: FileInfoResult[] }>(
      `/api/files/info?file_code=${encodeURIComponent(codes)}`
    );
    return result.result;
  }

  /** Get a fresh presigned download URL for a file by its UUID (public - no API key needed). */
  async getDownloadUrl(fileId: string): Promise<DownloadUrlResult> {
    const result = await this.request<{ success: true; data: DownloadUrlResult }>(
      `/api/files/download/${encodeURIComponent(fileId)}`
    );
    return result.data;
  }

  /** Download a file's content as a Blob. */
  async downloadFile(fileId: string): Promise<Blob> {
    const { url } = await this.getDownloadUrl(fileId);
    const response = await fetch(url);
    if (!response.ok) throw new VBlobCDNError('Failed to download file', response.status);
    return response.blob();
  }

  /**
   * Delete a file by its UUID. Owner keys authenticate via the
   * Authorization header; anonymous uploads need their deletion token
   * instead (returned nowhere in this client - it's only shown once at
   * upload time via the raw API response for anonymous uploads).
   */
  async deleteFile(fileId: string, deletionToken?: string): Promise<void> {
    const params = new URLSearchParams({ fileId });
    if (deletionToken) params.set('token', deletionToken);
    await this.request(`/api/files/delete?${params.toString()}`, { method: 'DELETE' });
  }

  /** Delete up to 100 key-owned files in one call. Requires the "delete" permission. */
  async batchDeleteFiles(fileIds: string[]): Promise<BatchDeleteResult> {
    const result = await this.request<{ success: true; data: BatchDeleteResult }>('/api/files/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds }),
    });
    return result.data;
  }
}

// Node.js specific export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VBlobCDN, VBlobCDNError };
}
