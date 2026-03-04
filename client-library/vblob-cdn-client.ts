/**
 * TypeScript/JavaScript Client Library for Vercel Blob CDN API
 * 
 * Usage:
 * ```typescript
 * import { VBlobCDN } from './vblob-cdn-client';
 * 
 * const cdn = new VBlobCDN('your-api-key', 'https://your-domain.com');
 * 
 * // Upload a file
 * const result = await cdn.upload(file);
 * console.log('Download URL:', result.downloadUrl);
 * 
 * // List files
 * const files = await cdn.listFiles();
 * 
 * // Get file info
 * const info = await cdn.getFile(fileId);
 * 
 * // Delete a file
 * await cdn.deleteFile(fileId);
 * ```
 */

export interface VBlobCDNConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

export interface UploadResult {
  fileId: string;
  downloadUrl: string;
  directDownloadUrl: string;
}

export interface FileInfo {
  fileId: string;
  name: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
  directDownloadUrl: string;
  contentType?: string;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
  permissions: {
    upload: boolean;
    download: boolean;
    delete: boolean;
    list: boolean;
  };
  rateLimit: {
    requestsPerHour: number;
    uploadSizeLimit: number;
    uploadSizeLimitMB: number;
  };
  usage: {
    requestCount: number;
    uploadCount: number;
    downloadCount: number;
    totalBytesUploaded: number;
    totalBytesDownloaded: number;
    totalUploadedMB: number;
    totalDownloadedMB: number;
  };
}

export interface ListFilesOptions {
  limit?: number;
  prefix?: string;
}

export interface ListFilesResult {
  files: FileInfo[];
  count: number;
  total: number;
  hasMore: boolean;
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
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(apiKey: string, baseUrl: string, timeout: number = 30000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new VBlobCDNError(
          data.error || 'Request failed',
          response.status,
          data
        );
      }

      return data.data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof VBlobCDNError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new VBlobCDNError(error.message);
      }

      throw new VBlobCDNError('Unknown error occurred');
    }
  }

  /**
   * Get API key information and usage statistics
   */
  async getInfo(): Promise<ApiKeyInfo> {
    return this.request<ApiKeyInfo>('/info');
  }

  /**
   * Upload a file to the CDN
   * 
   * @param file - File to upload (File, Blob, or Buffer)
   * @param filename - Optional custom filename
   * @param contentType - Optional content type
   * @returns Upload result with download URLs
   */
  async upload(
    file: File | Blob | Buffer,
    filename?: string,
    contentType?: string
  ): Promise<UploadResult> {
    // Get file metadata
    let size: number;
    let type: string;
    let name: string;

    if (file instanceof File) {
      size = file.size;
      type = contentType || file.type;
      name = filename || file.name;
    } else if (file instanceof Blob) {
      size = file.size;
      type = contentType || file.type || 'application/octet-stream';
      name = filename || 'blob';
    } else {
      // Buffer
      size = file.length;
      type = contentType || 'application/octet-stream';
      name = filename || 'file';
    }

    // Step 1: Get presigned upload URL
    const uploadData = await this.request<{
      uploadUrl: string;
      fileId: string;
      downloadUrl: string;
      directDownloadUrl: string;
      method: string;
    }>('/upload', {
      method: 'POST',
      body: JSON.stringify({
        filename: name,
        contentType: type,
        size,
      }),
    });

    // Step 2: Upload the file
    const uploadResponse = await fetch(uploadData.uploadUrl, {
      method: uploadData.method,
      headers: {
        'Content-Type': type,
      },
      body: file as any, // File, Blob, or Buffer are all valid BodyInit types
    });

    if (!uploadResponse.ok) {
      throw new VBlobCDNError(
        'Failed to upload file',
        uploadResponse.status
      );
    }

    return {
      fileId: uploadData.fileId,
      downloadUrl: uploadData.downloadUrl,
      directDownloadUrl: uploadData.directDownloadUrl,
    };
  }

  /**
   * Get information about a file
   * 
   * @param fileId - ID of the file
   * @returns File information including download URL
   */
  async getFile(fileId: string): Promise<FileInfo> {
    const data = await this.request<{
      fileId: string;
      downloadUrl: string;
      directDownloadUrl: string;
      contentType?: string;
      size?: number;
    }>(`/files/${encodeURIComponent(fileId)}`);

    return {
      fileId: data.fileId,
      name: data.fileId.split('/').pop() || '',
      size: data.size || 0,
      lastModified: new Date().toISOString(), // Not available in current response
      downloadUrl: data.downloadUrl,
      directDownloadUrl: data.directDownloadUrl,
      contentType: data.contentType,
    };
  }

  /**
   * List files uploaded with this API key
   * 
   * @param options - Listing options (limit, prefix)
   * @returns List of files
   */
  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    const params = new URLSearchParams();
    
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    
    if (options.prefix) {
      params.append('prefix', options.prefix);
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    
    return this.request<ListFilesResult>(`/files${query}`);
  }

  /**
   * Delete a file
   * 
   * @param fileId - ID of the file to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.request(`/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Download a file as a Blob
   * 
   * @param fileId - ID of the file
   * @returns File content as Blob
   */
  async downloadFile(fileId: string): Promise<Blob> {
    const fileInfo = await this.getFile(fileId);
    
    const response = await fetch(fileInfo.downloadUrl);
    
    if (!response.ok) {
      throw new VBlobCDNError(
        'Failed to download file',
        response.status
      );
    }

    return response.blob();
  }

  /**
   * Check if a file exists
   * 
   * @param fileId - ID of the file
   * @returns True if file exists
   */
  async fileExists(fileId: string): Promise<boolean> {
    try {
      await this.getFile(fileId);
      return true;
    } catch (error) {
      if (error instanceof VBlobCDNError && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}

// Node.js specific export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VBlobCDN, VBlobCDNError };
}
