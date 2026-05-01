'use client';

import { useState, useRef, useEffect, type SVGProps } from 'react';
import Image from 'next/image';
// import AdBanner from './components/AdBanner';
import logo from './logo.png';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  size: number;
  ip?: string;
}

interface UploadedItem {
  url: string;
  filename: string;
  size: number;
  timestamp: number;
}

type UploadQueueItem = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'success' | 'error';
  error?: string;
  loadedBytes?: number;
  totalBytes?: number;
  contentHash?: string;
  // Multipart state for true resume across refresh.
  multipart?: {
    objectKey: string;
    uploadId: string;
    partSize: number;
    parts: Array<{ partNumber: number; etag: string }>;
  };
  addedAt: number;
};

type MonoIconName =
  | 'cloudUpload'
  | 'spark'
  | 'warning'
  | 'check'
  | 'arrowLeft'
  | 'refresh'
  | 'retry'
  | 'close'
  | 'folder'
  | 'pause'
  | 'play'
  | 'share';

function MonoIcon({
  name,
  className,
  ...props
}: { name: MonoIconName; className?: string } & SVGProps<SVGSVGElement>) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'cloudUpload':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M7.5 18.5h8.8a3.7 3.7 0 0 0 .7-7.33A5.3 5.3 0 0 0 6.6 9.6 3.7 3.7 0 0 0 7.5 18.5Z" />
          <path {...common} d="M12 15V8" />
          <path {...common} d="m8.8 11.8 3.2-3.2 3.2 3.2" />
        </svg>
      );
    case 'spark':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M12 3.5l1.8 4.6L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.9L12 3.5Z" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M12 4.5 21 19.5H3L12 4.5Z" />
          <path {...common} d="M12 9v4.8" />
          <path {...common} d="M12 16.8h.01" />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          <path {...common} d="m8.5 12.4 2.4 2.4 4.7-5.2" />
        </svg>
      );
    case 'arrowLeft':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M10 6 4 12l6 6" />
          <path {...common} d="M5 12h15" />
        </svg>
      );
    case 'refresh':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M20 12a8 8 0 0 0-14.8-4.2" />
          <path {...common} d="M6 4v4h4" />
          <path {...common} d="M4 12a8 8 0 0 0 14.8 4.2" />
          <path {...common} d="M18 20v-4h-4" />
        </svg>
      );
    case 'pause':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M8 6.5v11" />
          <path {...common} d="M16 6.5v11" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M9 6.8v10.4l8.3-5.2L9 6.8Z" />
        </svg>
      );
    case 'share':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M15 6h3a1.5 1.5 0 0 1 1.5 1.5v3" />
          <path {...common} d="M10 14 19.5 4.5" />
          <path {...common} d="M16 4.5H19.5V8" />
          <path {...common} d="M5.5 8.5v9A1.5 1.5 0 0 0 7 19h9" />
        </svg>
      );
    case 'retry':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M20 12a8 8 0 0 0-14.8-4.2" />
          <path {...common} d="M6 4v4h4" />
        </svg>
      );
    case 'close':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M6 6 18 18" />
          <path {...common} d="M18 6 6 18" />
        </svg>
      );
    case 'folder':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <path {...common} d="M3.5 7.5h6.1l1.8 2.2h8.1v8.8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V7.5Z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Home() {
  // Feature flag: keep the public history UI code around, but hide it from the UI for now.
  // Flip this to `true` anytime to bring the "Uploads" button + history view back.
  const ENABLE_PUBLIC_UPLOAD_HISTORY_UI = false;

  const FREE_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
  const PREMIUM_MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
  const [uploadedFiles, setUploadedFiles] = useState<UploadedItem[]>([]);
  const [showUploadedFiles, setShowUploadedFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadLoadedBytes, setUploadLoadedBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [currentUploadName, setCurrentUploadName] = useState('');
  const [uploadFilePreview, setUploadFilePreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeView, setActiveView] = useState<'upload' | 'history'>('upload');
  const [publicHistory, setPublicHistory] = useState<UploadRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [verifyingFiles, setVerifyingFiles] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumEmail, setPremiumEmail] = useState('');
  const toastTimeoutRef = useRef<number | null>(null);
  const cancelUploadRef = useRef(false);
  const cancelTokenRef = useRef(0);
  const activeUploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const queuePausedRef = useRef(false);
  const queueXhrsRef = useRef<Record<string, XMLHttpRequest | null>>({});
  const emptyMessages = [
    { icon: 'cloudUpload' as const, title: 'No uploads yet', detail: 'Drop a file to start building your vault.' },
    { icon: 'spark' as const, title: 'Empty for now', detail: 'Your latest upload will show up here.' },
    { icon: 'folder' as const, title: 'Nothing here yet', detail: 'Upload a file and it will appear automatically.' },
    { icon: 'cloudUpload' as const, title: 'Ready when you are', detail: 'Choose a file or drag one into the window.' },
    { icon: 'spark' as const, title: 'Fresh start', detail: 'A clean space for your next upload.' },
  ];
  const [emptyMessageIndex] = useState(() => Math.floor(Math.random() * emptyMessages.length));
  const [uploadSuccessCue, setUploadSuccessCue] = useState<{ filename: string; label: string } | null>(null);
  const uploadSuccessTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxUploadBytes = isPremium ? PREMIUM_MAX_UPLOAD_BYTES : FREE_MAX_UPLOAD_BYTES;
  const [showRemoteUpload, setShowRemoteUpload] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteAuthHeader, setRemoteAuthHeader] = useState('');
  const [remoteFilenameOverride, setRemoteFilenameOverride] = useState('');
  const [remoteUploading, setRemoteUploading] = useState(false);
  const [remoteStage, setRemoteStage] = useState<'idle' | 'download' | 'enqueue' | 'server'>('idle');
  const [remoteDownloadedBytes, setRemoteDownloadedBytes] = useState(0);
  const [remoteTotalBytes, setRemoteTotalBytes] = useState<number | null>(null);

  useEffect(() => {
    // Persist uploaded links across reloads for a more seamless feel.
    try {
      const raw = window.localStorage.getItem('relay:uploadedFiles');
      if (raw) {
        const parsed = JSON.parse(raw) as UploadedItem[];
        if (Array.isArray(parsed)) {
          setUploadedFiles(parsed.slice(0, 50));
        }
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('relay:uploadedFiles', JSON.stringify(uploadedFiles.slice(0, 50)));
    } catch {
      // Ignore storage errors.
    }
  }, [uploadedFiles]);

  useEffect(() => {
    return () => {
      if (uploadSuccessTimeoutRef.current) {
        window.clearTimeout(uploadSuccessTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    queuePausedRef.current = queuePaused;
  }, [queuePaused]);

  useEffect(() => {
    if (uploadedFiles.length === 0 && showUploadedFiles) {
      setShowUploadedFiles(false);
    }
  }, [uploadedFiles.length, showUploadedFiles]);

  const QUEUE_META_KEY = 'relay:uploadQueueMeta:v1';
  const IDB_NAME = 'relay_uploads_v1';
  const IDB_STORE = 'files';

  const openUploadsDb = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const idbPut = async (key: string, value: any) => {
    const db = await openUploadsDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbGet = async <T,>(key: string): Promise<T | null> => {
    const db = await openUploadsDb();
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  };

  const idbDel = async (key: string) => {
    const db = await openUploadsDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  type QueueMeta = Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    lastModified: number;
    status: UploadQueueItem['status'];
    error?: string;
    addedAt: number;
    loadedBytes?: number;
    totalBytes?: number;
    contentHash?: string;
    multipart?: UploadQueueItem['multipart'];
  }>;

  const persistQueueMeta = (next: UploadQueueItem[]) => {
    const meta: QueueMeta = next.map((it) => ({
      id: it.id,
      name: it.file.name,
      type: it.file.type,
      size: it.file.size,
      lastModified: it.file.lastModified,
      status: it.status,
      error: it.error,
      addedAt: it.addedAt,
      loadedBytes: it.loadedBytes,
      totalBytes: it.totalBytes,
      contentHash: it.contentHash,
      multipart: it.multipart,
    }));

    try {
      window.localStorage.setItem(QUEUE_META_KEY, JSON.stringify(meta));
    } catch {
      // ignore
    }
  };

  // Restore queue after refresh (files are stored in IndexedDB).
  useEffect(() => {
    (async () => {
      try {
        const raw = window.localStorage.getItem(QUEUE_META_KEY);
        if (!raw) return;
        const meta = JSON.parse(raw) as QueueMeta;
        if (!Array.isArray(meta) || meta.length === 0) return;

        const restored: UploadQueueItem[] = [];
        for (const m of meta) {
          const stored = await idbGet<{ blob: Blob; name: string; type: string; lastModified: number }>(m.id);
          if (!stored?.blob) {
            // If bytes are missing, keep the entry but mark it failed.
            restored.push({
              id: m.id,
              file: new File([], m.name || 'missing-file'),
              status: 'error',
              error: 'Missing local file bytes (cleared storage)',
              addedAt: m.addedAt || Date.now(),
              contentHash: m.contentHash,
            });
            continue;
          }
          const file = new File([stored.blob], stored.name || m.name, {
            type: stored.type || m.type,
            lastModified: stored.lastModified || m.lastModified,
          });
          restored.push({
            id: m.id,
            file,
            status: m.status === 'uploading' ? 'queued' : m.status, // restart uploads on refresh
            error: m.error,
            addedAt: m.addedAt || Date.now(),
            loadedBytes: m.loadedBytes,
            totalBytes: m.totalBytes,
            contentHash: m.contentHash,
            multipart: m.multipart,
          });
        }

        if (restored.length) {
          setUploadQueue(restored);
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep queue meta durable for resume-after-refresh.
    try {
      persistQueueMeta(uploadQueue);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadQueue]);

  useEffect(() => {
    fetch('/api/premium/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        setIsPremium(Boolean(data.premium));
        setPremiumEmail(data?.user?.email || '');
      })
      .catch(() => {
        setIsPremium(false);
        setPremiumEmail('');
      });

    // Track page view
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageview', path: '/' })
    }).catch(() => {}); // Silently fail
    
    if (ENABLE_PUBLIC_UPLOAD_HISTORY_UI) {
      fetchPublicHistory();
    } else {
      setLoadingHistory(false);
    }
  }, []);

  const logoutPremium = async () => {
    try {
      await fetch('/api/premium/logout', { method: 'POST' });
      setIsPremium(false);
      setPremiumEmail('');
      showToast('Premium logout successful', 'info');
    } catch {
      showToast('Failed to logout premium account', 'error');
    }
  };

  useEffect(() => {
    const handleWindowDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleWindowDragEnter = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleWindowDragLeave = (event: DragEvent) => {
      if (event.target === document || event.target === document.body) {
        setIsDragging(false);
      }
    };

    const handleWindowDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      handleFileDrop(event.dataTransfer);
    };

    const handleVisibilityChange = () => {
      if (document.hidden && uploading) {
        // User switched tabs during upload - warn them
        console.warn('Tab switched during upload. Upload may be throttled by browser.');
        showToast('Keep this tab open during upload.', 'info');
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [uploading]);

  const fetchPublicHistory = async () => {
    const startTime = Date.now();
    try {
      setLoadingHistory(true);
      setVerifyingFiles(true);
      const response = await fetch('/api/history', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const records = data.history || [];

        // Verify each file still exists
        const verifiedRecords = await verifyFileExistence(records);
        setPublicHistory(verifiedRecords);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 600) {
        await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
      }
      setLoadingHistory(false);
      setVerifyingFiles(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  const showUploadSuccessCue = (filename: string, label = 'Upload complete') => {
    setUploadSuccessCue({ filename, label });
    if (uploadSuccessTimeoutRef.current) {
      window.clearTimeout(uploadSuccessTimeoutRef.current);
    }
    uploadSuccessTimeoutRef.current = window.setTimeout(() => {
      setUploadSuccessCue(null);
    }, 1800);
  };

  const makeQueueId = () => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const MAX_CONCURRENT_UPLOADS = 3;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const computeFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  const ensureContentHash = async (item: UploadQueueItem): Promise<string> => {
    if (item.contentHash) return item.contentHash;
    const hash = await computeFileHash(item.file);
    setUploadQueue((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, contentHash: hash } : it))
    );
    return hash;
  };

  const checkDuplicateUpload = async (hash: string, file: File): Promise<string | null> => {
    const res = await fetch('/api/dedupe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash,
        size: file.size,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || 'Duplicate check failed');
    }

    if (payload?.duplicate && payload?.data?.downloadUrl) {
      return payload.data.downloadUrl as string;
    }

    return null;
  };

  const commitFileHash = async (hash: string, objectKey: string, file: File): Promise<void> => {
    try {
      await fetch('/api/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit: true,
          hash,
          objectKey,
          size: file.size,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
        }),
      });
    } catch {
      // Best effort.
    }
  };

  const fetchWithRetry = async (
    input: RequestInfo | URL,
    init: RequestInit,
    attempts = 3
  ): Promise<Response> => {
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(input, init);
        if (res.ok) return res;
        // Retry on transient server errors / throttling.
        if (res.status >= 500 || res.status === 429) {
          const backoff = 350 * Math.pow(2, i) + Math.floor(Math.random() * 180);
          await sleep(backoff);
          continue;
        }
        return res;
      } catch (err) {
        lastError = err;
        const backoff = 350 * Math.pow(2, i) + Math.floor(Math.random() * 180);
        await sleep(backoff);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Network error');
  };

  const enqueueFiles = (files: File[]) => {
    const now = Date.now();
    const items: UploadQueueItem[] = files.map((file) => ({
      id: makeQueueId(),
      file,
      status: 'queued',
      addedAt: now,
      loadedBytes: 0,
      totalBytes: file.size,
    }));
    setUploadQueue((prev) => [...prev, ...items]);
    cancelUploadRef.current = false;
    queuePausedRef.current = false;
    setQueuePaused(false);
    setActiveView('upload');
    showToast(`${files.length} file${files.length === 1 ? '' : 's'} added to queue`, 'info');

    // Persist bytes for resume-after-refresh.
    for (const item of items) {
      idbPut(item.id, {
        blob: item.file,
        name: item.file.name,
        type: item.file.type,
        lastModified: item.file.lastModified,
      }).catch(() => {});
    }
  };

  const generateRandomFilename = (originalFilename: string): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomName = '';
    for (let i = 0; i < 6; i++) {
      randomName += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const extension = originalFilename.includes('.') 
      ? '.' + originalFilename.split('.').pop() 
      : '';
    return randomName + extension;
  };

  const verifyFileExistence = async (records: UploadRecord[]): Promise<UploadRecord[]> => {
    const verifiedRecords: UploadRecord[] = [];
    const deletedUrls: string[] = [];
    // Check each file and only remove records on confirmed 404 responses.
    for (const record of records) {
      try {
        const parsed = new URL(record.url);
        const filename = parsed.pathname.split('/').pop();
        const probeUrl = filename ? `/d/${filename}` : parsed.pathname;
        const response = await fetch(probeUrl, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) {
          verifiedRecords.push(record);
        } else if (response.status === 404) {
          deletedUrls.push(record.url);
        } else {
          // Keep record on transient errors (403/429/5xx/etc).
          verifiedRecords.push(record);
        }
      } catch {
        // Keep record when network checks fail; don't wipe history on transient issues.
        verifiedRecords.push(record);
      }
    }
    // Remove deleted files from history
    if (deletedUrls.length > 0) {
      await fetch('/api/history/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: deletedUrls })
      });
    }
    return verifiedRecords;
  };

  const uploadToPresignedUrl = (
    uploadUrl: string,
    file: File,
    onProgress: (loaded: number, total: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeUploadRequestRef.current = xhr;

      xhr.open('PUT', uploadUrl, true);
      if (file.type) {
        xhr.setRequestHeader('Content-Type', file.type);
      }

      xhr.upload.onprogress = (event) => {
        const total = event.total || file.size;
        onProgress(event.loaded, total);
      };

      xhr.onload = () => {
        activeUploadRequestRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        reject(new Error(`Upload failed with status ${xhr.status}`));
      };

      xhr.onerror = () => {
        activeUploadRequestRef.current = null;
        reject(new Error('Upload request failed'));
      };

      xhr.onabort = () => {
        activeUploadRequestRef.current = null;
        reject(new Error('Upload cancelled'));
      };

      xhr.send(file);
    });
  };

  const uploadFile = async (file: File, notify: boolean = true) => {
    cancelUploadRef.current = false;
    setCurrentUploadName(file.name);
    if (file.size > maxUploadBytes) {
      showToast(`File is too large (max ${formatFileSize(maxUploadBytes)})`, 'error');
      throw new Error('File too large');
    }

    // Generate preview for images and videos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (file.type.startsWith('video/')) {
          // For videos, extract a frame (use the video element)
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              setUploadFilePreview(canvas.toDataURL('image/jpeg', 0.7));
            }
          };
          video.src = e.target?.result as string;
        } else {
          // For images, use directly
          setUploadFilePreview(e.target?.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setUploadFilePreview('');
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Checking for duplicates...');
    setUploadLoadedBytes(0);
    setUploadTotalBytes(file.size);

    try {
      const contentHash = await computeFileHash(file);
      const duplicateUrl = await checkDuplicateUpload(contentHash, file);
      if (duplicateUrl) {
        const uploadedAt = Date.now();
        setUploadedFiles((prev) => [
          {
            url: duplicateUrl,
            filename: file.name,
            size: file.size,
            timestamp: uploadedAt,
          },
          ...prev,
        ]);

        const historyResponse = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: duplicateUrl,
            filename: file.name,
            size: file.size,
          }),
        });

        if (!historyResponse.ok) {
          const errorPayload = await historyResponse.json().catch(() => ({}));
          throw new Error(errorPayload?.error || 'Failed to save upload history');
        }

        if (ENABLE_PUBLIC_UPLOAD_HISTORY_UI) {
          await fetchPublicHistory();
        }
        showUploadSuccessCue(file.name);
        if (notify) {
          showToast('Upload complete', 'success');
        }
        return;
      }

      setUploadStatus('Preparing upload...');
      const randomFilename = generateRandomFilename(file.name);
      const pathname = `d/${randomFilename}`;

      const initResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          filename: file.name,
        }),
      });

      const initPayload = await initResponse.json();
      if (!initResponse.ok || !initPayload?.uploadUrl) {
        throw new Error(initPayload?.error || 'Failed to initialize upload');
      }

      await uploadToPresignedUrl(initPayload.uploadUrl, file, (loaded, total) => {
        if (cancelUploadRef.current) {
          return;
        }
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
        setUploadProgress(Math.min(100, percent));
        setUploadStatus(`Uploading ${percent}%`);
        setUploadLoadedBytes(loaded);
        setUploadTotalBytes(total);
      });

      if (cancelUploadRef.current) {
        return;
      }

      const filename = pathname.split('/').pop() || '';
      const newUrl = `${window.location.origin}/download/${filename}`;
      const uploadedAt = Date.now();

      setUploadedFiles(prev => [
        {
          url: newUrl,
          filename: file.name,
          size: file.size,
          timestamp: uploadedAt
        },
        ...prev
      ]);

      // Persist upload in history.
      const historyResponse = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl,
          filename: file.name,
          size: file.size
        })
      });

      if (!historyResponse.ok) {
        const errorPayload = await historyResponse.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'Failed to save upload history');
      }

      await commitFileHash(contentHash, pathname, file);

      // Refresh history
      if (ENABLE_PUBLIC_UPLOAD_HISTORY_UI) {
        await fetchPublicHistory();
      }
      showUploadSuccessCue(file.name);
      if (notify) {
        showToast('Upload complete', 'success');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      if (notify) {
        showToast('Upload failed', 'error');
      }
      throw error;
    } finally {
      activeUploadRequestRef.current = null;
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      setUploadLoadedBytes(0);
      setUploadTotalBytes(0);
      setUploadFilePreview('');
    }
  };

  // Queue engine: starts the next queued item when idle.
  const uploadQueueItem = async (item: UploadQueueItem) => {
    const itemId = item.id;
    const file = item.file;
    const cancelToken = cancelTokenRef.current;
    const throwIfPaused = () => {
      if (queuePausedRef.current) {
        throw new Error('Upload paused');
      }
    };
    const throwIfCancelled = () => {
      if (cancelUploadRef.current || cancelTokenRef.current !== cancelToken) {
        throw new Error('Upload cancelled');
      }
    };
    throwIfPaused();
    throwIfCancelled();
    if (file.size > maxUploadBytes) {
      throw new Error('File too large');
    }

    setUploadStatus('Checking for duplicates...');
    const contentHash = await ensureContentHash(item);
    throwIfPaused();
    throwIfCancelled();
    const duplicateUrl = await checkDuplicateUpload(contentHash, file);
    throwIfPaused();
    if (duplicateUrl) {
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, loadedBytes: file.size, totalBytes: file.size } : it
        )
      );

      const uploadedAt = Date.now();
      setUploadedFiles((prev) => [
        {
          url: duplicateUrl,
          filename: file.name,
          size: file.size,
          timestamp: uploadedAt,
        },
        ...prev,
      ]);

      const historyResponse = await fetchWithRetry(
        '/api/history',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: duplicateUrl,
            filename: file.name,
            size: file.size,
          }),
        },
        2
      );

      if (!historyResponse.ok) {
        const errorPayload = await historyResponse.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'Failed to save upload history');
      }

      if (ENABLE_PUBLIC_UPLOAD_HISTORY_UI) {
        await fetchPublicHistory();
      }

      return;
    }

    // Always use multipart for true resume-after-refresh.
    let multipart = item.multipart;

    if (!multipart) {
      const randomFilename = generateRandomFilename(file.name);
      const pathname = `d/${randomFilename}`;
      const initRes = await fetchWithRetry(
        '/api/multipart/init',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pathname,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
            filename: file.name,
          }),
        },
        3
      );

      const initPayload = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initPayload?.data?.uploadId || !initPayload?.data?.objectKey) {
        throw new Error(initPayload?.error || 'Failed to initialize multipart upload');
      }
      throwIfPaused();

      multipart = {
        objectKey: initPayload.data.objectKey as string,
        uploadId: initPayload.data.uploadId as string,
        partSize: Number(initPayload.data.partSize) || 8 * 1024 * 1024,
        parts: [],
      };

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, multipart } : it))
      );
    }

    const partSize = Math.max(5 * 1024 * 1024, multipart.partSize);
    const totalParts = Math.ceil(file.size / partSize);
    const done = new Map<number, string>(multipart.parts.map((p) => [p.partNumber, p.etag]));

    const uploadPartXhr = (url: string, blob: Blob, startOffset: number) =>
      new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        queueXhrsRef.current[itemId] = xhr;
        xhr.open('PUT', url, true);

        xhr.upload.onprogress = (event) => {
          const loaded = startOffset + (event.loaded || 0);
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === itemId ? { ...it, loadedBytes: loaded, totalBytes: file.size } : it
            )
          );
        };

        xhr.onload = () => {
          queueXhrsRef.current[itemId] = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || '';
            resolve(etag.replace(/^\"|\"$/g, '') || etag);
            return;
          }
          reject(new Error(`Part upload failed with status ${xhr.status}`));
        };

        xhr.onerror = () => {
          queueXhrsRef.current[itemId] = null;
          reject(new Error('Part upload request failed'));
        };

        xhr.onabort = () => {
          queueXhrsRef.current[itemId] = null;
          reject(new Error('Upload cancelled'));
        };

        xhr.send(blob);
      });

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      throwIfPaused();
      throwIfCancelled();
      if (done.has(partNumber)) {
        continue;
      }

      const start = (partNumber - 1) * partSize;
      const end = Math.min(file.size, start + partSize);
      const blob = file.slice(start, end);

      const presignRes = await fetchWithRetry(
        '/api/multipart/part',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId: multipart.uploadId,
            objectKey: multipart.objectKey,
            partNumber,
          }),
        },
        3
      );
      const presignPayload = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok || !presignPayload?.data?.url) {
        throw new Error(presignPayload?.error || 'Failed to presign upload part');
      }
      throwIfPaused();

      const etag = await uploadPartXhr(presignPayload.data.url as string, blob, start);
      throwIfCancelled();
      done.set(partNumber, etag);

      const nextParts = Array.from(done.entries())
        .map(([pn, e]) => ({ partNumber: pn, etag: e }))
        .sort((a, b) => a.partNumber - b.partNumber);
      multipart.parts = nextParts;

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, multipart } : it))
      );
    }

    const completeRes = await fetchWithRetry(
      '/api/multipart/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: multipart.uploadId,
          objectKey: multipart.objectKey,
          parts: multipart.parts,
        }),
      },
      2
    );
    const completePayload = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) {
      throw new Error(completePayload?.error || 'Failed to complete multipart upload');
    }

    const uploadedFilename = multipart.objectKey.split('/').pop() || '';
    const newUrl = `${window.location.origin}/download/${uploadedFilename}`;
    const uploadedAt = Date.now();

    setUploadedFiles((prev) => [
      {
        url: newUrl,
        filename: file.name,
        size: file.size,
        timestamp: uploadedAt,
      },
      ...prev,
    ]);

    const historyResponse = await fetchWithRetry(
      '/api/history',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl,
          filename: file.name,
          size: file.size,
        }),
      },
      2
    );

    if (!historyResponse.ok) {
      const errorPayload = await historyResponse.json().catch(() => ({}));
      throw new Error(errorPayload?.error || 'Failed to save upload history');
    }

    await commitFileHash(contentHash, multipart.objectKey, file);
  };

  useEffect(() => {
    if (queuePaused) return;

    const active = uploadQueue.filter((q) => q.status === 'uploading').length;
    if (active >= MAX_CONCURRENT_UPLOADS) return;

    const toStart = uploadQueue
      .filter((q) => q.status === 'queued')
      .slice(0, MAX_CONCURRENT_UPLOADS - active);
    if (toStart.length === 0) return;

    // Mark as uploading synchronously to avoid double-start.
    const ids = new Set(toStart.map((t) => t.id));
    setUploadQueue((prev) =>
      prev.map((it) =>
        ids.has(it.id) ? { ...it, status: 'uploading', error: undefined, loadedBytes: 0, totalBytes: it.file.size } : it
      )
    );

    // Keep the top banner visible while any are active.
    setUploading(true);

    for (const item of toStart) {
      (async () => {
        try {
          await uploadQueueItem(item);
          setUploadQueue((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, status: 'success' } : it))
          );
          showUploadSuccessCue(item.file.name);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Upload failed';
          if (message === 'Upload paused' || message === 'Upload cancelled') {
            setUploadQueue((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, status: 'queued', error: undefined } : it))
            );
            return;
          }
          setUploadQueue((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, status: 'error', error: message } : it))
          );
        }
      })();
    }
  }, [uploadQueue, queuePaused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const active = uploadQueue.filter((q) => q.status === 'uploading');
    const anyUploading = active.length > 0;
    setUploading(anyUploading);

    if (!anyUploading) {
      setUploadProgress(0);
      setUploadStatus('');
      setUploadLoadedBytes(0);
      setUploadTotalBytes(0);
      setCurrentUploadName('');
      return;
    }

    // Drive the top banner off the first active upload.
    const primary = active[0];
    setCurrentUploadName(primary.file.name);
    const loaded = primary.loadedBytes ?? 0;
    const total = primary.totalBytes ?? primary.file.size;
    setUploadLoadedBytes(loaded);
    setUploadTotalBytes(total);
    const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
    setUploadProgress(Math.min(100, Math.max(0, pct)));
    setUploadStatus(`Uploading ${Math.min(100, Math.max(0, pct))}% • ${active.length} active`);
  }, [uploadQueue]);

  const cancelUpload = () => {
    if (!uploading) {
      return;
    }

    // Cancel any active queued uploads.
    cancelTokenRef.current += 1;
    cancelUploadRef.current = true;
    queuePausedRef.current = false;
    setQueuePaused(false);
    if (activeUploadRequestRef.current) {
      try {
        activeUploadRequestRef.current.abort();
      } catch {
        // ignore
      }
      activeUploadRequestRef.current = null;
    }
    for (const [id, xhr] of Object.entries(queueXhrsRef.current)) {
      if (xhr) {
        try {
          xhr.abort();
        } catch {
          // ignore
        }
        queueXhrsRef.current[id] = null;
      }
    }
    cancelUploadRef.current = false;
    setUploadQueue((prev) =>
      prev.map((it) => (it.status === 'uploading' ? { ...it, status: 'queued', error: undefined } : it))
    );
    setCurrentUploadName('');
    setUploadStatus('');
    setUploadProgress(0);
    setUploadLoadedBytes(0);
    setUploadTotalBytes(0);
    setUploading(false);
    showToast('Upload cancelled', 'info');
    window.setTimeout(() => {
      cancelUploadRef.current = false;
    }, 0);
  };

  const pauseQueue = () => {
    queuePausedRef.current = true;
    setQueuePaused(true);
    // Abort active uploads and return them to queued.
    for (const [id, xhr] of Object.entries(queueXhrsRef.current)) {
      if (xhr) {
        try {
          xhr.abort();
        } catch {
          // ignore
        }
        queueXhrsRef.current[id] = null;
      }
    }
    setUploadQueue((prev) =>
      prev.map((it) => (it.status === 'uploading' ? { ...it, status: 'queued', error: undefined } : it))
    );
    showToast('Queue paused', 'info');
  };

  const resumeQueue = () => {
    cancelUploadRef.current = false;
    queuePausedRef.current = false;
    setQueuePaused(false);
    showToast('Queue resumed', 'info');
  };

  const retryQueueItem = (id: string) => {
    setUploadQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: 'queued', error: undefined } : it))
    );
  };

  const getDownloadLinks = (): string[] => {
    return uploadedFiles.map(file => {
      // For files uploaded in this session, the URL is already the download page link
      if (file.url.includes('/download/')) {
        return file.url;
      }
      // For legacy files or if needed, extract filename and create download page URL
      const filename = file.url.split('/').pop() || '';
      return `${window.location.origin}/download/${filename}`;
    });
  };

  const copyAllUploadedLinks = () => {
    if (uploadedFiles.length === 0) {
      showToast('No uploaded links yet', 'info');
      return;
    }

    const allLinks = getDownloadLinks().join('\n');
    copyText(allLinks, 'All links copied');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    enqueueFiles(files);
    e.target.value = '';
  };

  const handleFileDrop = async (dataTransfer: DataTransfer | null) => {
    const files = Array.from(dataTransfer?.files || []);
    if (files.length === 0) return;
    setActiveView('upload');
    enqueueFiles(files);
  };

  const submitRemoteUpload = async () => {
    if (uploading || remoteUploading) {
      return;
    }

    const trimmed = remoteUrl.trim();
    if (!trimmed) {
      showToast('Paste a URL first', 'info');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      showToast('Invalid URL', 'error');
      return;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      showToast('URL must start with http:// or https://', 'error');
      return;
    }

    setRemoteUploading(true);
    setRemoteStage('download');
    setRemoteDownloadedBytes(0);
    setRemoteTotalBytes(null);
    setUploadStatus('Fetching remote file...');
    setActiveView('upload');
    showToast('Fetching remote file…', 'info');

    try {
      // First try client-side fetch so we can show real download progress (works when CORS allows it).
      try {
        const clientRes = await fetch(trimmed, {
          method: 'GET',
          headers: remoteAuthHeader.trim() ? { Authorization: remoteAuthHeader.trim() } : undefined,
          redirect: 'follow',
        });

        if (!clientRes.ok || !clientRes.body) {
          throw new Error('Client fetch failed');
        }

        const ct = clientRes.headers.get('content-type') || 'application/octet-stream';
        const lenHeader = clientRes.headers.get('content-length');
        const total = lenHeader ? Number(lenHeader) : NaN;
        setRemoteTotalBytes(Number.isFinite(total) ? total : null);

        const chunks: ArrayBuffer[] = [];
        const reader = clientRes.body.getReader();
        let loaded = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            // Store ArrayBuffer slices to keep types consistent across runtimes.
            chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
            loaded += value.byteLength;
            setRemoteDownloadedBytes(loaded);
            if (Number.isFinite(total) && total > 0) {
              const pct = Math.round((loaded / total) * 100);
              setUploadStatus(`Downloading remote file ${Math.min(100, pct)}%`);
            } else {
              setUploadStatus(`Downloading remote file… ${formatFileSize(loaded)}`);
            }
          }
        }

        const blob = new Blob(chunks, { type: ct });
        const inferredName =
          remoteFilenameOverride.trim() ||
          parsed.pathname.split('/').filter(Boolean).pop() ||
          'remote-file';
        const safeName = inferredName || 'remote-file';
        const file = new File([blob], safeName, { type: ct });

        if (file.size > maxUploadBytes) {
          throw new Error('File too large');
        }

        setRemoteStage('enqueue');
        setUploadStatus('Uploading…');
        enqueueFiles([file]);

        setRemoteUrl('');
        setRemoteAuthHeader('');
        setRemoteFilenameOverride('');
        setShowRemoteUpload(false);
        showToast('Remote file queued', 'success');
        return;
      } catch {
        // Fall back to server-side remote upload when the browser cannot fetch (CORS, auth, etc).
      }

      setRemoteStage('server');
      const res = await fetch('/api/remote-upload/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmed,
          filename: remoteFilenameOverride.trim() || undefined,
          headers: remoteAuthHeader.trim()
            ? { Authorization: remoteAuthHeader.trim() }
            : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Remote upload failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let donePayload: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          let evt: any;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === 'progress') {
            if (typeof evt.total === 'number' && Number.isFinite(evt.total)) {
              setRemoteTotalBytes(evt.total);
            } else {
              setRemoteTotalBytes(null);
            }
            if (typeof evt.loaded === 'number') {
              setRemoteDownloadedBytes(evt.loaded);
              if (typeof evt.total === 'number' && evt.total > 0) {
                const pct = Math.round((evt.loaded / evt.total) * 100);
                setUploadStatus(`${evt.stage === 'upload' ? 'Uploading' : 'Downloading'} ${Math.min(100, pct)}%`);
              }
            }
          } else if (evt.type === 'done') {
            donePayload = evt;
          } else if (evt.type === 'error') {
            throw new Error(evt.error || 'Remote upload failed');
          }
        }
      }

      if (!donePayload?.data?.url) {
        throw new Error('Remote upload failed');
      }

      const downloadUrl = donePayload.data.url as string;
      const filename = (donePayload.data.filename as string) || parsed.pathname.split('/').pop() || 'remote-file';
      const size = Number(donePayload.data.size) || 0;
      const uploadedAt = Date.now();

      setUploadedFiles((prev) => [
        {
          url: downloadUrl,
          filename,
          size,
          timestamp: uploadedAt,
        },
        ...prev,
      ]);

      // Persist in history (re-uses the same quota logic as regular uploads).
      const historyRes = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: downloadUrl, filename, size }),
      });
      if (!historyRes.ok) {
        const errPayload = await historyRes.json().catch(() => ({}));
        throw new Error(errPayload?.error || 'Failed to save upload history');
      }

      if (ENABLE_PUBLIC_UPLOAD_HISTORY_UI) {
        await fetchPublicHistory();
      }

      showUploadSuccessCue(filename);
      setRemoteUrl('');
      setRemoteAuthHeader('');
      setRemoteFilenameOverride('');
      setShowRemoteUpload(false);
      showToast('Remote upload complete', 'success');
    } catch (error) {
      console.error('Remote upload failed:', error);
      showToast(error instanceof Error ? error.message : 'Remote upload failed', 'error');
    } finally {
      setRemoteUploading(false);
      setRemoteStage('idle');
      setRemoteDownloadedBytes(0);
      setRemoteTotalBytes(null);
      setUploadStatus('');
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileDrop(e.dataTransfer);
  };

  const copyText = (text: string, successMessage: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMessage, 'success');
    }).catch((err) => {
      console.error('Failed to copy to clipboard:', err);
      showToast('Copy failed', 'error');
    });
  };

  const copyToClipboard = (url: string) => {
    copyText(url, 'Copied to clipboard');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDisplayName = (filename: string) => {
    return filename;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background: radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%);
          background-attachment: fixed;
          color: #eef1f6;
          font-family: 'Sora', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        @keyframes iconFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.9; }
          50% { transform: translateY(-1px) scale(1.03); opacity: 1; }
        }

        @keyframes successPop {
          0% { transform: scale(0.72); opacity: 0; }
          55% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes successSweep {
          0% { transform: translateX(-120%) skewX(-16deg); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translateX(120%) skewX(-16deg); opacity: 0; }
        }

        @keyframes successGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(79,248,192,0); }
          50% { box-shadow: 0 0 24px rgba(79,248,192,0.28); }
        }

        @keyframes slideSide {
          0%   { transform: translateX(0) scaleX(1); opacity: 1; }
          35%  { transform: translateX(0) scaleX(1); opacity: 1; }
          48%  { transform: translateX(600px) scaleX(1.3); opacity: 0; }
          49%  { transform: translateX(-600px) scaleX(1.3); opacity: 0; }
          62%  { transform: translateX(0) scaleX(1); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        .monoIcon {
          display: inline-flex;
          vertical-align: middle;
          animation: iconFloat 2.8s ease-in-out infinite;
          color: #eef1f6;
        }

        .monoIcon--success {
          animation: successPop 420ms ease-out, iconFloat 2.8s ease-in-out infinite 420ms;
        }

        .uploadSuccessCard {
          animation: fadeSlideIn 260ms ease-out, successGlow 1.5s ease-in-out infinite;
        }

        .uploadSuccessSweep {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(79,248,192,0), rgba(79,248,192,0.28), rgba(79,248,192,0));
          animation: successSweep 1.2s ease-in-out infinite;
          pointer-events: none;
        }
      `}} />

      <main style={{
        padding: uploading ? '6.5rem 6vw 4rem' : '4rem 6vw',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {uploadSuccessCue && !uploading && (
          <div className="uploadSuccessCard" style={{
            width: '100%',
            maxWidth: '1200px',
            marginBottom: '1rem',
            padding: '0.85rem 1.05rem',
            borderRadius: '16px',
            border: '1px solid rgba(79,248,192,0.35)',
            background: 'linear-gradient(135deg, rgba(79,248,192,0.16), rgba(255,255,255,0.05))',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div className="uploadSuccessSweep" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
              <MonoIcon name="check" className="monoIcon monoIcon--success" width={22} height={22} style={{ color: '#7ef4cb', flex: '0 0 auto' }} />
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#eef1f6' }}>
                  {uploadSuccessCue.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a9b2c1', wordBreak: 'break-all' }}>
                  {uploadSuccessCue.filename}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#7ef4cb', fontSize: '0.74rem', fontWeight: 700 }}>
              <MonoIcon name="spark" className="monoIcon monoIcon--success" width={14} height={14} style={{ color: '#7ef4cb' }} />
              Saved
            </div>
          </div>
        )}

        {uploading && (
          <div style={{
            width: '100%',
            maxWidth: '1200px',
            marginBottom: '1.5rem',
            padding: '0.75rem 1.2rem',
            borderRadius: '0 0 18px 18px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderTop: 'none',
            background: 'rgba(17,19,24,0.65)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={cancelUpload}
              style={{
                padding: '0.5rem 0.9rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: '#eef1f6',
                fontSize: '0.8rem',
                fontWeight: 500,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <MonoIcon name="arrowLeft" className="monoIcon" width={14} height={14} />
                Back
              </span>
            </button>
            {uploadFilePreview && (
              <img
                src={uploadFilePreview}
                alt="Upload preview"
                style={{
                  height: '32px',
                  width: '32px',
                  borderRadius: '6px',
                  objectFit: 'cover',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              />
            )}
            <div style={{
              fontSize: '0.78rem',
              color: '#c3cad6',
              letterSpacing: '0.03em',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <MonoIcon
                  name={uploadProgress >= 100 ? 'check' : 'cloudUpload'}
                  className={uploadProgress >= 100 ? 'monoIcon monoIcon--success' : 'monoIcon'}
                  width={14}
                  height={14}
                  style={{ color: uploadProgress >= 100 ? '#7ef4cb' : '#eef1f6' }}
                />
                {currentUploadName ? `${currentUploadName} • ` : ''}
                {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Preparing upload…'}
                {uploadQueue.some((q) => q.status === 'queued') && (
                  <span style={{ color: '#8a92a1' }}>
                    {' '}
                    • {uploadQueue.filter((q) => q.status === 'queued').length} queued
                  </span>
                )}
              </div>
              <div style={{ 
                fontSize: '0.65rem', 
                color: '#858d9d',
                fontStyle: 'italic'
              }}>
                Keep this tab open during upload
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <button
                onClick={cancelUpload}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.13)',
                  background: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#eef1f6',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={queuePaused ? resumeQueue : pauseQueue}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.13)',
                  background: queuePaused ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#eef1f6',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
                title={queuePaused ? 'Resume queue' : 'Pause queue'}
              >
                {queuePaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={copyAllUploadedLinks}
                disabled={uploadedFiles.length === 0}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '999px',
                  border: uploadedFiles.length === 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(233,236,242,0.5)',
                  background: uploadedFiles.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(233,236,242,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: uploadedFiles.length === 0 ? '#8a92a1' : '#eef1f6',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  cursor: uploadedFiles.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                Copy all links
              </button>
            </div>
          </div>
        )}

        {!uploading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '0.1rem'
        }}>
          <Image
            src={logo}
            alt="Logo"
            width={200}
            height={200}
               style={{
                 animation: 'slideSide 5.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
               }}
          />
          <h1 style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#eef1f6',
          animation: 'fadeSlideIn 1s ease-out',
          textAlign: 'center'
        }}>
          Quick, secure, and
          <br />
          seamless file sharing.
        </h1>
          <div
            style={{
              marginTop: '0.2rem',
              width: '100%',
              maxWidth: '520px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.72rem',
                color: '#b5bcc9',
                letterSpacing: '0.02em'
              }}
            >
              {isPremium ? (
                <span style={{ color: '#8a92a1' }}>
                  {premiumEmail || 'Active'}
                </span>
              ) : (
                <span style={{ color: '#8a92a1' }}>
                  Premium = Higher limits + no ads
                </span>
              )}
            </div>

            {isPremium ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <a
                  href="/premium/dashboard"
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.13)',
                    background: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#c3cad6',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  Dashboard
                </a>
                <button
                  onClick={logoutPremium}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.13)',
                    background: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#c3cad6',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <a
                href="/premium"
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(233,236,242,0.35)',
                  background: 'rgba(233,236,242,0.15)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  color: '#eef1f6',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                Premium login
              </a>
            )}
          </div>
        </div>
        )}

        {!uploading && (
          <p
            style={{
              marginTop: '0.4rem',
              marginBottom: '0.2rem',
              fontSize: '0.7rem',
              color: '#8a92a1',
              textAlign: 'center',
              letterSpacing: '0.03em'
            }}
          >
          </p>
        )}


        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {!uploading && isDragging && (
          <div
            style={{
              marginTop: '0.25rem',
              marginBottom: '1.25rem',
              width: '100%',
              maxWidth: '520px',
              padding: '1.6rem 1.5rem',
              borderRadius: '18px',
              border: '1px dashed rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#eef1f6',
              cursor: 'default',
              transition: 'border-color 0.2s ease',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div style={{
              fontSize: '0.95rem',
              letterSpacing: '0.02em',
              fontWeight: 400
            }}>
              Drop the file to upload
            </div>
            <div style={{
              marginTop: '0.35rem',
              fontSize: '0.75rem',
              color: '#8a92a1'
            }}>
              Release to start uploading
            </div>
          </div>
        )}
        
        {!uploading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginTop: '0.20rem',
          animation: 'fadeSlideIn 1s ease-out 0.2s backwards'
        }}>
          {ENABLE_PUBLIC_UPLOAD_HISTORY_UI && (
            <button
              onClick={() => setActiveView(activeView === 'history' ? 'upload' : 'history')}
              style={{
                fontFamily: "'Sora', sans-serif",
                padding: '0.42rem 1.55rem',
                fontSize: '0.82rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                color: '#eef1f6',
                background: activeView === 'history' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '50px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = activeView === 'history' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
              }}
            >
              Uploads
            </button>
          )}

          <button
            onClick={() => {
              setShowRemoteUpload((v) => !v);
              setActiveView('upload');
            }}
            style={{
              fontFamily: "'Sora', sans-serif",
              padding: '0.42rem 1.55rem',
              fontSize: '0.82rem',
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: '#eef1f6',
              background: showRemoteUpload ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.13)',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = showRemoteUpload ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
            }}
          >
            {remoteUploading ? 'Remote Uploading…' : 'Remote Upload'}
          </button>

          <button
            onClick={() => {
              setActiveView('upload');
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            style={{
              fontFamily: "'Sora', sans-serif",
              padding: '0.42rem 1.55rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: uploading ? 'rgba(255,255,255,0.35)' : '#eef1f6',
              background: uploading ? 'rgba(255,255,255,0.04)' : 'rgba(233,236,242,0.18)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: uploading ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(233,236,242,0.35)',
              borderRadius: '50px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1,
              boxShadow: uploading ? 'none' : '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}
            onMouseEnter={(e) => {
              if (!uploading) {
                e.currentTarget.style.background = 'rgba(233,236,242,0.26)';
                e.currentTarget.style.borderColor = 'rgba(233,236,242,0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!uploading) {
                e.currentTarget.style.background = 'rgba(233,236,242,0.18)';
                e.currentTarget.style.borderColor = 'rgba(233,236,242,0.35)';
              }
            }}
          >
            {uploading ? 'Uploading...' : 'Choose File'}
          </button>
        </div>
        )}

        {!uploading && showRemoteUpload && (
          <div style={{
            marginTop: '0.85rem',
            width: '100%',
            maxWidth: '520px',
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            animation: 'fadeSlideIn 0.45s ease-out'
          }}>
            <input
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="Paste a file URL (https://...)"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={remoteUploading}
              style={{
                flex: '1 1 320px',
                minWidth: '240px',
                padding: '0.55rem 0.9rem',
                fontSize: '0.82rem',
                fontFamily: "'Sora', sans-serif",
                color: '#eef1f6',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                outline: 'none',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitRemoteUpload();
                }
              }}
            />
            <input
              value={remoteFilenameOverride}
              onChange={(e) => setRemoteFilenameOverride(e.target.value)}
              placeholder="Filename (optional)"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={remoteUploading}
              style={{
                flex: '1 1 160px',
                minWidth: '160px',
                padding: '0.55rem 0.9rem',
                fontSize: '0.82rem',
                fontFamily: "'Sora', sans-serif",
                color: '#eef1f6',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                outline: 'none',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
              }}
            />
            <input
              value={remoteAuthHeader}
              onChange={(e) => setRemoteAuthHeader(e.target.value)}
              placeholder="Authorization header (optional)"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={remoteUploading}
              style={{
                flex: '1 1 240px',
                minWidth: '220px',
                padding: '0.55rem 0.9rem',
                fontSize: '0.82rem',
                fontFamily: "'Sora', sans-serif",
                color: '#eef1f6',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                outline: 'none',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
              }}
            />
            <button
              onClick={submitRemoteUpload}
              disabled={remoteUploading || remoteUrl.trim().length === 0}
              style={{
                fontFamily: "'Sora', sans-serif",
                padding: '0.55rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: remoteUploading || remoteUrl.trim().length === 0 ? 'rgba(255,255,255,0.35)' : '#0a0a0a',
                background: remoteUploading || remoteUrl.trim().length === 0 ? 'rgba(255,255,255,0.05)' : '#e9ecf2',
                border: '1px solid rgba(233,236,242,0.35)',
                borderRadius: '12px',
                cursor: remoteUploading || remoteUrl.trim().length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Upload URL
            </button>

            {remoteUploading && (
              <div
                style={{
                  width: '100%',
                  marginTop: '0.35rem',
                  fontSize: '0.72rem',
                  color: '#8a92a1',
                  textAlign: 'center',
                }}
              >
                {remoteStage === 'download' && (
                  <>
                    Downloading remote…{' '}
                    {remoteTotalBytes
                      ? `${Math.min(100, Math.round((remoteDownloadedBytes / remoteTotalBytes) * 100))}% (${formatFileSize(remoteDownloadedBytes)} / ${formatFileSize(remoteTotalBytes)})`
                      : `${formatFileSize(remoteDownloadedBytes)}`}
                  </>
                )}
                {remoteStage === 'server' && <>Fetching server-side…</>}
                {remoteStage === 'enqueue' && <>Queued for upload…</>}
              </div>
            )}
          </div>
        )}

        {!uploading && (
        <p style={{
          marginTop: '0.85rem',
          fontSize: '0.6rem',
          color: '#8a92a1',
          textAlign: 'center',
          letterSpacing: '0.02em'
        }}>
          Max upload size: {formatFileSize(maxUploadBytes)} per file {isPremium ? '• Premium' : '• Free'}
        </p>
        )}

        {!uploading && uploadQueue.length > 0 && (
          <div
            style={{
              marginTop: '1.2rem',
              width: '100%',
              maxWidth: '720px',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '0.85rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
              animation: 'fadeSlideIn 0.6s ease-out'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: '0.65rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#eef1f6' }}>
                Queue • {uploadQueue.filter((q) => q.status === 'queued').length} waiting
                {uploadQueue.some((q) => q.status === 'error') ? ` • ${uploadQueue.filter((q) => q.status === 'error').length} failed` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => (queuePaused ? resumeQueue() : pauseQueue())}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.13)',
                    background: queuePaused ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#eef1f6',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MonoIcon name={queuePaused ? 'play' : 'pause'} className="monoIcon" width={12} height={12} />
                    {queuePaused ? 'Resume' : 'Pause'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setUploadQueue((prev) => {
                      const doneIds = prev.filter((q) => q.status === 'success').map((q) => q.id);
                      for (const id of doneIds) {
                        idbDel(id).catch(() => {});
                      }
                      return prev.filter((q) => q.status !== 'success');
                    });
                  }}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.13)',
                    background: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#eef1f6',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                  }}
                  title="Remove successful items from the list"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MonoIcon name="close" className="monoIcon" width={12} height={12} />
                    Clear done
                  </span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {uploadQueue
                .slice()
                .sort((a, b) => a.addedAt - b.addedAt)
                .slice(0, 8)
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.7rem 0.85rem',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.09)',
                      background: 'rgba(255,255,255,0.04)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: '0.85rem', color: '#eef1f6', wordBreak: 'break-all' }}>
                        {item.file.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#8a92a1' }}>
                        {formatFileSize(item.file.size)} • {item.status === 'queued' ? (queuePaused ? 'Paused' : 'Queued') : item.status === 'success' ? 'Done' : item.status === 'error' ? 'Failed' : 'Uploading'}
                        {item.status === 'uploading' && typeof item.loadedBytes === 'number' && typeof item.totalBytes === 'number' && item.totalBytes > 0 && (
                          <span>
                            {' '}
                            • {Math.min(100, Math.round((item.loadedBytes / item.totalBytes) * 100))}%
                          </span>
                        )}
                        {item.status === 'error' && item.error ? ` • ${item.error}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {item.status === 'error' && (
                        <button
                          onClick={() => retryQueueItem(item.id)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.13)',
                            background: 'rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            color: '#eef1f6',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                          }}
                          title="Retry"
                          aria-label="Retry upload"
                        >
                          <MonoIcon name="retry" className="monoIcon" width={12} height={12} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setUploadQueue((prev) => prev.filter((q) => q.id !== item.id));
                          idbDel(item.id).catch(() => {});
                        }}
                        disabled={item.status === 'uploading'}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.13)',
                          background: 'rgba(255,255,255,0.07)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          color: item.status === 'uploading' ? 'rgba(245,245,245,0.35)' : '#eef1f6',
                          cursor: item.status === 'uploading' ? 'not-allowed' : 'pointer',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                        }}
                        title={item.status === 'uploading' ? 'Cannot remove while uploading' : 'Remove'}
                        aria-label="Remove from queue"
                      >
                        <MonoIcon name="close" className="monoIcon" width={12} height={12} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {uploadQueue.length > 8 && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', color: '#8a92a1' }}>
                Showing first 8 items.
              </div>
            )}
          </div>
        )}

        


        {activeView === 'upload' && uploading && (
          <div style={{
            marginTop: '1.5rem',
            width: '100%',
            maxWidth: '420px',
            animation: 'fadeSlideIn 0.5s ease-out'
          }}>
            {currentUploadName && (
              <div style={{
                marginBottom: '0.35rem',
                fontSize: '0.78rem',
                color: '#b5bcc9',
                textAlign: 'center'
              }}>
                {currentUploadName}
              </div>
            )}
            <div style={{
              height: '8px',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '999px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: uploadProgress >= 100
                  ? 'linear-gradient(90deg, #7ef4cb 0%, #eef1f6 50%, #7ef4cb 100%)'
                  : '#e9ecf2',
                transition: 'width 0.2s ease-out'
              }} />
              {uploadProgress >= 100 && <div className="uploadSuccessSweep" />}
            </div>
            <p style={{
              marginTop: '0.6rem',
              fontSize: '0.85rem',
              color: '#8a92a1',
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'center' }}>
                <MonoIcon
                  name={uploadProgress >= 100 ? 'check' : 'cloudUpload'}
                  className={uploadProgress >= 100 ? 'monoIcon monoIcon--success' : 'monoIcon'}
                  width={13}
                  height={13}
                  style={{ color: uploadProgress >= 100 ? '#7ef4cb' : '#eef1f6' }}
                />
                {uploadStatus || 'Uploading…'}
              </span>
              {uploadTotalBytes > 0 && (
                <span> • {formatFileSize(uploadLoadedBytes)} / {formatFileSize(uploadTotalBytes)}</span>
              )}
            </p>
          </div>
        )}

        {activeView === 'upload' && uploadedFiles.length > 0 && (
          <div style={{
            marginTop: '1.6rem',
            display: 'flex',
            justifyContent: 'center',
            animation: 'fadeSlideIn 0.7s ease-out'
          }}>
            <button
              onClick={() => setShowUploadedFiles((prev) => !prev)}
              style={{
                fontFamily: "'Sora', sans-serif",
                padding: '0.45rem 1.4rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: '#eef1f6',
                background: showUploadedFiles ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '50px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = showUploadedFiles ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
              }}
              aria-expanded={showUploadedFiles}
              aria-controls="uploaded-files-list"
            >
              {showUploadedFiles ? 'Hide files' : `Show files • ${uploadedFiles.length}`}
            </button>
          </div>
        )}

        {activeView === 'upload' && uploadedFiles.length > 0 && showUploadedFiles && (
          <div style={{
            marginTop: '2rem',
            animation: 'fadeSlideIn 0.8s ease-out',
            width: '100%',
            maxWidth: '720px'
          }}>
            <p style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: '#eef1f6',
              fontWeight: 500,
              textAlign: 'center'
            }}>
              Uploaded Files • {uploadedFiles.length}
            </p>
            
            <div
              id="uploaded-files-list"
              style={{
              maxHeight: '320px',
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '0.85rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)'
            }}>
              {uploadedFiles.map((fileItem, index) => {
                const filename = fileItem.filename;
                const url = fileItem.url;
                const lowerExt = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lowerExt || '');
                const keyFromUrl = url.includes('/download/')
                  ? url.split('/download/').pop()
                  : url.split('/').pop();
                const thumbKey = keyFromUrl ? keyFromUrl.split('?')[0] : '';
                const extension = filename.includes('.')
                  ? filename.split('.').pop()?.toUpperCase()
                  : 'FILE';

                return (
                  <div
                    key={index}
                    style={{
                      marginBottom: index < uploadedFiles.length - 1 ? '0.85rem' : '0',
                      padding: '0.95rem 1.1rem',
                      background: 'rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: '16px',
                      transition: 'border-color 0.2s ease',
                      cursor: 'default',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minWidth: 0
                      }}>
                        {isImage && thumbKey && (
                          <img
                            src={`/api/thumbnail?key=${encodeURIComponent(thumbKey)}&w=96&h=96`}
                            alt=""
                            loading="lazy"
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '12px',
                              objectFit: 'cover',
                              border: '1px solid rgba(255,255,255,0.12)',
                              background: 'rgba(255,255,255,0.04)'
                            }}
                          />
                        )}
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '999px',
                          background: '#e9ecf2',
                          opacity: 0.8
                        }} />
                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#eef1f6',
                            fontWeight: 500,
                            wordBreak: 'break-all'
                          }}>
                            {formatDisplayName(filename)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#8a92a1'
                          }}>
                            Uploaded {formatTimestamp(fileItem.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem'
                      }}>
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#eef1f6',
                          background: 'rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.13)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          letterSpacing: '0.08em',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)'
                        }}>
                          {extension}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(url);
                          }}
                          aria-label="Share link"
                          title="Share link"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.13)',
                            background: 'rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            color: '#e9ecf2',
                            fontSize: '0.9rem',
                            lineHeight: '1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                          }}
                        >
                          <MonoIcon name="share" className="monoIcon" width={12} height={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      marginTop: '0.75rem',
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr',
                      gap: '0.35rem 0.9rem',
                      alignItems: 'center',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#8a92a1',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Link
                      </div>
                      <a 
                        href={url.includes('/download/') ? url : `${window.location.origin}/download/${url.split('/').pop()}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: '#b5bcc9',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {url}
                      </a>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Minimal: AdBanner removed for cleaner look */}

        {/* Public Upload History */}
        {ENABLE_PUBLIC_UPLOAD_HISTORY_UI && activeView === 'history' && (
        <div style={{
          marginTop: '3rem',
          width: '100%',
          maxWidth: '720px',
          animation: 'fadeSlideIn 1s ease-out 0.4s backwards'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1rem',
              fontWeight: 500,
              textAlign: 'center',
              color: '#eef1f6'
            }}>
              Public Upload History
            </h2>
            <button
              onClick={() => !verifyingFiles && fetchPublicHistory()}
              aria-label="Refresh upload history"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: verifyingFiles ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
              onMouseEnter={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.13)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
                }
              }}
              onMouseLeave={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
                }
              }}
            >
              {verifyingFiles ? (
                <span style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '999px',
                  border: '2px solid rgba(233, 236, 242, 0.7)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }} />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(233, 236, 242, 0.9)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              )}
            </button>
          </div>

          {loadingHistory ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#8a92a1',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              Loading history...
            </div>
          ) : publicHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '12px',
              color: '#8a92a1',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)'
            }}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: '0.75rem' }}>
                <MonoIcon
                  name={emptyMessages[emptyMessageIndex].icon}
                  className="monoIcon"
                  width={28}
                  height={28}
                  style={{ color: '#eef1f6' }}
                />
                <div style={{ color: '#eef1f6', fontSize: '0.9rem', fontWeight: 600 }}>
                  {emptyMessages[emptyMessageIndex].title}
                </div>
                <div style={{ maxWidth: '28rem', lineHeight: 1.5, fontSize: '0.78rem', color: '#8a92a1' }}>
                  {emptyMessages[emptyMessageIndex].detail}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '0.85rem',
              maxHeight: '320px',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)'
            }}>
              {publicHistory.map((record, index) => {
                const extension = record.filename.includes('.')
                  ? record.filename.split('.').pop()?.toUpperCase()
                  : 'FILE';

                return (
                  <div
                    key={index}
                    style={{
                      marginBottom: index < publicHistory.length - 1 ? '0.85rem' : '0',
                      padding: '0.95rem 1.1rem',
                      background: 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.11)',
                      borderRadius: '16px',
                      transition: 'border-color 0.2s ease, background 0.2s ease',
                      cursor: 'default',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minWidth: 0
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '999px',
                          background: '#e9ecf2',
                          opacity: 0.8
                        }} />
                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#eef1f6',
                            fontWeight: 500,
                            wordBreak: 'break-all'
                          }}>
                            {formatDisplayName(record.filename)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#8a92a1'
                          }}>
                            Uploaded {formatTimestamp(record.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem'
                      }}>
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#eef1f6',
                          background: 'rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.13)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          letterSpacing: '0.08em',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)'
                        }}>
                          {extension}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(record.url);
                          }}
                          aria-label="Share link"
                          title="Share link"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.13)',
                            background: 'rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            color: '#e9ecf2',
                            fontSize: '0.9rem',
                            lineHeight: '1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                          }}
                        >
                          <MonoIcon name="share" className="monoIcon" width={12} height={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      marginTop: '0.75rem',
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr',
                      gap: '0.35rem 0.9rem',
                      alignItems: 'center',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#8a92a1',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Size
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#b5bcc9'
                      }}>
                        {formatFileSize(record.size)}
                      </div>


                      <div style={{
                        fontSize: '0.7rem',
                        color: '#8a92a1',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Link
                      </div>
                      <a 
                        href={record.url.includes('/download/') ? record.url : `${window.location.origin}/download/${record.url.split('/').pop()}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: '#b5bcc9',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.url}
                      </a>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div style={{
            marginTop: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2rem',
            flexWrap: 'wrap'
          }}>
            <p style={{
              opacity: 0.7,
              fontSize: '0.8rem',
              color: '#8a92a1',
              margin: 0
            }}>
              Showing {publicHistory.length} recent uploads {verifyingFiles ? '• Verifying files...' : ''}
            </p>
          </div>
        </div>
        )}

        {/* Toast Notifications */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            background: 'rgba(20,22,27,0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            color: '#eef1f6',
            padding: '0.65rem 0.95rem',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            animation: 'fadeSlideIn 0.25s ease-out',
            zIndex: 1000,
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.02em'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MonoIcon
                name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'warning' : 'spark'}
                className={toast.type === 'success' ? 'monoIcon monoIcon--success' : 'monoIcon'}
                width={14}
                height={14}
                style={{ color: toast.type === 'success' ? '#7ef4cb' : toast.type === 'error' ? '#f2c6c6' : '#eef1f6' }}
              />
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
