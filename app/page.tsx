'use client';

import { useMemo, useState, useRef, useEffect, type SVGProps } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
// import AdBanner from './components/AdBanner';
import logo from './logo.png';
import { useTheme } from './components/ThemeProvider';

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
  downloadUrl?: string;
  error?: string;
  loadedBytes?: number;
  totalBytes?: number;
  contentHash?: string;
  startedAt?: number;
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
  | 'share'
  | 'sun'
  | 'moon'
  | 'qrCode'
  | 'trash';

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
          <path {...common} d="M7 18h9.2a3.8 3.8 0 0 0 1-7.46A5.4 5.4 0 0 0 6.5 9.9 3.8 3.8 0 0 0 7 18Z" />
          <path {...common} d="M12 15V8.2" />
          <path {...common} d="M9.8 10.8 12 8.6l2.2 2.2" />
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
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} {...props}>
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="12" y1="2.5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="12" y1="19" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="2.5" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="19" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="5.22" y1="5.22" x2="6.94" y2="6.94" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="17.06" y1="17.06" x2="18.78" y2="18.78" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="5.22" y1="18.78" x2="6.94" y2="17.06" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="17.06" y1="6.94" x2="18.78" y2="5.22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'moon':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} {...props}>
          <path
            d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            fill="currentColor" fillOpacity="0.15"
          />
        </svg>
      );
    case 'qrCode':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <rect {...common} x="3" y="3" width="7" height="7" rx="1" />
          <rect {...common} x="14" y="3" width="7" height="7" rx="1" />
          <rect {...common} x="3" y="14" width="7" height="7" rx="1" />
          <path {...common} d="M14 14h3v3h-3zM17 17h3v3h-3zM14 17h.01M17 14h.01" />
        </svg>
      );
    case 'trash':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>
          <polyline {...common} points="3 6 5 6 21 6" />
          <path {...common} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path {...common} d="M10 11v6M14 11v6" />
          <path {...common} d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    default:
      return null;
  }
}

const ENABLE_PUBLIC_UPLOAD_HISTORY_UI = false;
const FREE_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const PREMIUM_MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const QUEUE_META_KEY = 'relay:uploadQueueMeta:v1';
const IDB_NAME = 'relay_uploads_v1';
const IDB_STORE = 'files';
const MAX_CONCURRENT_UPLOADS = 3;
const PARALLEL_PARTS = 6;

const DARK_T = {
  card: 'rgba(255,255,255,0.04)',
  surface: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  borderSub: 'rgba(255,255,255,0.08)',
  input: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
  dragBorder: 'rgba(255,255,255,0.22)',
  progressBg: 'rgba(255,255,255,0.03)',
} as const;
const LIGHT_T = {
  card: 'rgba(0,0,0,0.025)',
  surface: 'rgba(0,0,0,0.04)',
  border: 'rgba(0,0,0,0.1)',
  borderSub: 'rgba(0,0,0,0.07)',
  input: 'rgba(0,0,0,0.045)',
  inputBorder: 'rgba(0,0,0,0.12)',
  dragBorder: 'rgba(0,0,0,0.18)',
  progressBg: 'rgba(0,0,0,0.025)',
} as const;

const emptyMessages = [
  { icon: 'cloudUpload' as const, title: 'No uploads yet', detail: 'Drop a file to start building your vault.' },
  { icon: 'spark' as const, title: 'Empty for now', detail: 'Your latest upload will show up here.' },
  { icon: 'folder' as const, title: 'Nothing here yet', detail: 'Upload a file and it will appear automatically.' },
  { icon: 'cloudUpload' as const, title: 'Ready when you are', detail: 'Choose a file or drag one into the window.' },
  { icon: 'spark' as const, title: 'Fresh start', detail: 'A clean space for your next upload.' },
];

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatTimestamp(timestamp: number) {
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
}

function formatDisplayName(filename: string) {
  return filename;
}

function makeQueueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function generateRandomFilename(originalFilename: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomName = '';
  for (let i = 0; i < 6; i++) {
    randomName += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const extension = originalFilename.includes('.')
    ? '.' + originalFilename.split('.').pop()
    : '';
  return randomName + extension;
}

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

type IndexedDbValue = Parameters<IDBObjectStore['put']>[0];

const idbPut = async (key: string, value: IndexedDbValue) => {
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
  addedAt: number;
  error?: string;
  downloadUrl?: string;
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
    downloadUrl: it.downloadUrl,
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

const verifyFileExistence = async (records: UploadRecord[]): Promise<UploadRecord[]> => {
  const verifiedRecords: UploadRecord[] = [];
  const deletedUrls: string[] = [];
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
        verifiedRecords.push(record);
      }
    } catch {
      verifiedRecords.push(record);
    }
  }
  if (deletedUrls.length > 0) {
    await fetch('/api/history/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: deletedUrls })
    });
  }
  return verifiedRecords;
};

const computeFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedItem[]>([]);
  const [uploadedFilesSearch, setUploadedFilesSearch] = useState('');
  const [uploadedFilesFilter, setUploadedFilesFilter] = useState<'all' | 'images' | 'videos' | 'documents'>('all');
  const [showUploadedFiles, setShowUploadedFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadLoadedBytes, setUploadLoadedBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [currentUploadName, setCurrentUploadName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeView, setActiveView] = useState<'upload' | 'history'>('upload');
  const [publicHistory, setPublicHistory] = useState<UploadRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [verifyingFiles, setVerifyingFiles] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);
  const [toastsExpanded, setToastsExpanded] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumEmail, setPremiumEmail] = useState('');
  const toastTimeoutRefs = useRef<Record<number, number>>({});
  const toastIdRef = useRef(0);
  const cancelUploadRef = useRef(false);
  const cancelTokenRef = useRef(0);
  const activeUploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const queuePausedRef = useRef(false);
  const queueXhrsRef = useRef<Record<string, Set<XMLHttpRequest>>>({});
  const [emptyMessageIndex] = useState(() => Math.floor(Math.random() * emptyMessages.length));
  const [uploadSuccessCue, setUploadSuccessCue] = useState<{ filename: string; label: string; exiting?: boolean } | null>(null);
  const uploadSuccessTimeoutRef = useRef<number | null>(null);
  const uploadSuccessExitTimeoutRef = useRef<number | null>(null);
  const queueProgressRafRef = useRef<Record<string, number | null>>({});
  const queueProgressPendingRef = useRef<Record<string, { loaded: number; total: number }>>({});
  const remoteProgressRafRef = useRef<number | null>(null);
  const remoteProgressPendingRef = useRef<{ loaded: number; total: number | null; status: string } | null>(null);
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

  // Feature state
  const { isDark } = useTheme();
  const [dragFileCount, setDragFileCount] = useState(0);
  const [qrPopoverUrl, setQrPopoverUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [deletingUrls, setDeletingUrls] = useState<Set<string>>(new Set());
  const lastSuccessUrlRef = useRef<string | null>(null);

  // Drive-style file manager
  const [fileViewMode, setFileViewMode] = useState<'grid' | 'list'>('list');
  const [fileSort, setFileSort] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [fileSortDir, setFileSortDir] = useState<'asc' | 'desc'>('desc');
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [filesFolderMap, setFilesFolderMap] = useState<Record<string, string>>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [renamingUrl, setRenamingUrl] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingFileUrl, setMovingFileUrl] = useState<string | null>(null);

  const t = isDark ? DARK_T : LIGHT_T;

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

  // Persist drive metadata (folders, folder assignments, display names).
  useEffect(() => {
    try {
      const f = localStorage.getItem('relay:folders');
      if (f) setFolders(JSON.parse(f));
      const m = localStorage.getItem('relay:filesFolderMap');
      if (m) setFilesFolderMap(JSON.parse(m));
      const n = localStorage.getItem('relay:displayNames');
      if (n) setDisplayNames(JSON.parse(n));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('relay:folders', JSON.stringify(folders)); } catch {}
  }, [folders]);
  useEffect(() => {
    try { localStorage.setItem('relay:filesFolderMap', JSON.stringify(filesFolderMap)); } catch {}
  }, [filesFolderMap]);
  useEffect(() => {
    try { localStorage.setItem('relay:displayNames', JSON.stringify(displayNames)); } catch {}
  }, [displayNames]);

  useEffect(() => {
    return () => {
      if (uploadSuccessTimeoutRef.current) {
        window.clearTimeout(uploadSuccessTimeoutRef.current);
      }
      if (uploadSuccessExitTimeoutRef.current) {
        window.clearTimeout(uploadSuccessExitTimeoutRef.current);
      }
      if (remoteProgressRafRef.current) {
        window.cancelAnimationFrame(remoteProgressRafRef.current);
      }
      for (const rafId of Object.values(queueProgressRafRef.current)) {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
        }
      }
    };
  }, []);

  useEffect(() => {
    queuePausedRef.current = queuePaused;
  }, [queuePaused]);

  // Feature 5: generate QR data URL whenever a popover URL is set.
  useEffect(() => {
    if (!qrPopoverUrl) { setQrDataUrl(''); return; }
    let cancelled = false;
    QRCode.toDataURL(qrPopoverUrl, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [qrPopoverUrl]);

  // Feature 3: Ctrl/Cmd+C copies the last uploaded link while the success cue is visible.
  useEffect(() => {
    if (!uploadSuccessCue) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'c') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const url = lastSuccessUrlRef.current;
      if (!url) return;
      e.preventDefault();
      navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success')).catch(() => {});
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [uploadSuccessCue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feature 1 & 6: paste files → enqueue; paste URL → pre-fill remote upload panel.
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        enqueueFiles(files);
        return;
      }
      const text = e.clipboardData?.getData('text/plain')?.trim() ?? '';
      if (!text) return;
      try {
        const parsed = new URL(text);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          e.preventDefault();
          setRemoteUrl(text);
          setShowRemoteUpload(true);
          setActiveView('upload');
          showToast('URL detected — hit "Upload URL" to fetch it', 'info');
        }
      } catch { /* not a URL */ }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (uploadedFiles.length === 0 && showUploadedFiles) {
      setShowUploadedFiles(false);
    }
  }, [uploadedFiles.length, showUploadedFiles]);

  // Validate uploaded files exist in R2 storage when first showing them.
  // Runs once per showUploadedFiles=true toggle; uses a snapshot to avoid
  // re-triggering itself when setUploadedFiles removes stale entries.
  const uploadedFilesRef = useRef(uploadedFiles);
  uploadedFilesRef.current = uploadedFiles;

  useEffect(() => {
    if (!showUploadedFiles || uploadedFilesRef.current.length === 0) return;

    let cancelled = false;
    const snapshot = uploadedFilesRef.current;

    const extractKey = (rawUrl: string): string => {
      try {
        const cleanPath = new URL(rawUrl, window.location.origin).pathname.replace(/\/+$/, '');
        if (cleanPath.includes('/download/')) return decodeURIComponent((cleanPath.split('/download/')[1] || '').split('?')[0] || '').trim();
        if (cleanPath.includes('/d/')) return decodeURIComponent((cleanPath.split('/d/')[1] || '').split('?')[0] || '').trim();
        return decodeURIComponent((cleanPath.split('/').filter(Boolean).pop() || '').split('?')[0] || '').trim();
      } catch {
        return decodeURIComponent(((rawUrl.split('/').filter(Boolean).pop() || '').split('?')[0] || '').trim());
      }
    };

    (async () => {
      try {
        const results = await Promise.allSettled(
          snapshot.map(async (file) => {
            const key = extractKey(file.url);
            if (!key) return { url: file.url, deleted: false };
            try {
              const res = await fetch(`/d/${encodeURIComponent(key)}`, { method: 'HEAD', cache: 'no-store' });
              return { url: file.url, deleted: res.status === 404 };
            } catch {
              return { url: file.url, deleted: false };
            }
          })
        );

        if (cancelled) return;

        const deletedSet = new Set(
          results
            .filter((r): r is PromiseFulfilledResult<{ url: string; deleted: boolean }> => r.status === 'fulfilled' && r.value.deleted)
            .map((r) => r.value.url)
        );

        if (deletedSet.size > 0) {
          setUploadedFiles((prev) => prev.filter((f) => !deletedSet.has(f.url)));
        }
      } catch (err) {
        console.error('Failed to validate uploaded files:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [showUploadedFiles]); // dep is only showUploadedFiles — snapshot via ref prevents re-run loop

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
            downloadUrl: m.downloadUrl,
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
        // Count files being dragged (available via items before drop).
        const count = event.dataTransfer.items
          ? Array.from(event.dataTransfer.items).filter((i) => i.kind === 'file').length
          : 0;
        setDragFileCount(count || 1);
      }
    };

    const handleWindowDragLeave = (event: DragEvent) => {
      if (event.target === document || event.target === document.body) {
        setIsDragging(false);
        setDragFileCount(0);
      }
    };

    const handleWindowDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      setDragFileCount(0);
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
    const id = toastIdRef.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 2200ms
    if (toastTimeoutRefs.current[id]) {
      window.clearTimeout(toastTimeoutRefs.current[id]);
    }
    toastTimeoutRefs.current[id] = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete toastTimeoutRefs.current[id];
    }, 2200);
  };

  const showUploadSuccessCue = (filename: string, label = 'Upload complete') => {
    setUploadSuccessCue({ filename, label, exiting: false });
    if (uploadSuccessTimeoutRef.current) {
      window.clearTimeout(uploadSuccessTimeoutRef.current);
    }
    if (uploadSuccessExitTimeoutRef.current) {
      window.clearTimeout(uploadSuccessExitTimeoutRef.current);
    }
    uploadSuccessTimeoutRef.current = window.setTimeout(() => {
      setUploadSuccessCue((current) => (current ? { ...current, exiting: true } : current));
      uploadSuccessExitTimeoutRef.current = window.setTimeout(() => {
        setUploadSuccessCue(null);
      }, 420);
    }, 2600);
  };

  const scheduleQueueUploadProgress = (itemId: string, loaded: number, total: number) => {
    queueProgressPendingRef.current[itemId] = { loaded, total };
    if (queueProgressRafRef.current[itemId] != null) return;
    queueProgressRafRef.current[itemId] = window.requestAnimationFrame(() => {
      queueProgressRafRef.current[itemId] = null;
      const pending = queueProgressPendingRef.current[itemId];
      if (!pending) return;
      delete queueProgressPendingRef.current[itemId];
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, loadedBytes: pending.loaded, totalBytes: pending.total } : it
        )
      );
    });
  };

  const scheduleRemoteUploadProgress = (loaded: number, total: number | null, status: string) => {
    remoteProgressPendingRef.current = { loaded, total, status };
    if (remoteProgressRafRef.current !== null) return;
    remoteProgressRafRef.current = window.requestAnimationFrame(() => {
      remoteProgressRafRef.current = null;
      const pending = remoteProgressPendingRef.current;
      if (!pending) return;
      remoteProgressPendingRef.current = null;
      setRemoteDownloadedBytes(pending.loaded);
      setUploadStatus(pending.status);
      setRemoteTotalBytes(pending.total);
    });
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
      const downloadPageUrl = toDownloadPageUrl(duplicateUrl);
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, loadedBytes: file.size, totalBytes: file.size, downloadUrl: downloadPageUrl }
            : it
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

      lastSuccessUrlRef.current = downloadPageUrl;
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

    // Track per-part loaded bytes so parallel uploads sum correctly.
    const partLoaded = new Map<number, number>();
    for (const [pn] of done) {
      const pStart = (pn - 1) * partSize;
      partLoaded.set(pn, Math.min(file.size, pStart + partSize) - pStart);
    }

    const uploadPartXhr = (
      url: string,
      blob: Blob,
      partNumber: number,
      partFullSize: number,
    ) =>
      new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const xhrSet = (queueXhrsRef.current[itemId] ??= new Set());
        xhrSet.add(xhr);
        xhr.open('PUT', url, true);

        xhr.upload.onprogress = (event) => {
          partLoaded.set(partNumber, event.loaded || 0);
          const total = Array.from(partLoaded.values()).reduce((a, b) => a + b, 0);
          scheduleQueueUploadProgress(itemId, total, file.size);
        };

        xhr.onload = () => {
          xhrSet.delete(xhr);
          if (xhr.status >= 200 && xhr.status < 300) {
            partLoaded.set(partNumber, partFullSize);
            const total = Array.from(partLoaded.values()).reduce((a, b) => a + b, 0);
            scheduleQueueUploadProgress(itemId, total, file.size);
            const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || '';
            resolve(etag.replace(/^\"|\"$/g, '') || etag);
            return;
          }
          reject(new Error(`Part upload failed with status ${xhr.status}`));
        };

        xhr.onerror = () => {
          xhrSet.delete(xhr);
          reject(new Error('Part upload request failed'));
        };

        xhr.onabort = () => {
          xhrSet.delete(xhr);
          reject(new Error('Upload cancelled'));
        };

        xhr.send(blob);
      });

    // Build list of parts that still need uploading.
    const pendingParts: number[] = [];
    for (let pn = 1; pn <= totalParts; pn++) {
      if (!done.has(pn)) pendingParts.push(pn);
    }

    // Upload PARALLEL_PARTS parts at a time: presign + PUT run concurrently within each batch.
    for (let i = 0; i < pendingParts.length; i += PARALLEL_PARTS) {
      throwIfPaused();
      throwIfCancelled();

      const batch = pendingParts.slice(i, i + PARALLEL_PARTS);

      const presigned = await Promise.all(
        batch.map(async (partNumber) => {
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
            3,
          );
          const presignPayload = await presignRes.json().catch(() => ({}));
          if (!presignRes.ok || !presignPayload?.data?.url) {
            throw new Error(presignPayload?.error || 'Failed to presign upload part');
          }
          return { partNumber, url: presignPayload.data.url as string };
        }),
      );

      throwIfPaused();
      throwIfCancelled();

      const uploaded = await Promise.all(
        presigned.map(async ({ partNumber, url }) => {
          const start = (partNumber - 1) * partSize;
          const end = Math.min(file.size, start + partSize);
          const etag = await uploadPartXhr(url, file.slice(start, end), partNumber, end - start);
          return { partNumber, etag };
        }),
      );

      for (const { partNumber, etag } of uploaded) {
        done.set(partNumber, etag);
      }

      multipart.parts = Array.from(done.entries())
        .map(([pn, e]) => ({ partNumber: pn, etag: e }))
        .sort((a, b) => a.partNumber - b.partNumber);

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, multipart } : it)),
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

    setUploadQueue((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, downloadUrl: newUrl } : it))
    );

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
    lastSuccessUrlRef.current = newUrl;
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
        ids.has(it.id) ? { ...it, status: 'uploading', error: undefined, loadedBytes: 0, totalBytes: it.file.size, startedAt: Date.now() } : it
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
    for (const [id, xhrs] of Object.entries(queueXhrsRef.current)) {
      for (const xhr of xhrs) {
        try { xhr.abort(); } catch { /* ignore */ }
      }
      xhrs.clear();
      delete queueXhrsRef.current[id];
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
    for (const [id, xhrs] of Object.entries(queueXhrsRef.current)) {
      for (const xhr of xhrs) {
        try { xhr.abort(); } catch { /* ignore */ }
      }
      xhrs.clear();
      delete queueXhrsRef.current[id];
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

  const deleteUploadedFile = async (url: string) => {
    setDeletingUrls((prev) => new Set(prev).add(url));
    try {
      const res = await fetch('/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Delete failed');
      }
      setUploadedFiles((prev) => prev.filter((f) => f.url !== url));
      showToast('File deleted', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeletingUrls((prev) => { const s = new Set(prev); s.delete(url); return s; });
    }
  };

  const toDownloadPageUrl = (rawUrl: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';

    try {
      const parsed = new URL(rawUrl, base || 'http://localhost');
      const cleanPath = parsed.pathname.replace(/\/+$/, '');

      if (cleanPath.includes('/download/')) {
        const key = cleanPath.split('/download/')[1] || '';
        return `${base}/download/${key}`;
      }

      if (cleanPath.includes('/d/')) {
        const key = cleanPath.split('/d/')[1] || '';
        return `${base}/download/${key}`;
      }

      const tail = cleanPath.split('/').filter(Boolean).pop() || '';
      return `${base}/download/${tail}`;
    } catch {
      const tail = rawUrl.split('/').filter(Boolean).pop() || '';
      return `${base}/download/${tail}`;
    }
  };

  const getDownloadLinks = (): string[] => {
    return uploadedFiles.map((file) => toDownloadPageUrl(file.url));
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
      type RemoteUploadDonePayload = {
        data?: {
          url?: string;
          filename?: string;
          size?: number;
        };
      };

      type RemoteUploadStreamEvent =
        | {
            type: 'progress';
            loaded?: number;
            total?: number;
            stage?: 'upload' | 'download';
          }
        | {
            type: 'done';
            data?: RemoteUploadDonePayload['data'];
          }
        | {
            type: 'error';
            error?: string;
          };

      let donePayload: RemoteUploadDonePayload | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          let evt: RemoteUploadStreamEvent;
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
              const total = typeof evt.total === 'number' && evt.total > 0 ? evt.total : null;
              const pct = total ? Math.round((evt.loaded / total) * 100) : 0;
              scheduleRemoteUploadProgress(
                evt.loaded,
                total,
                total
                  ? `${evt.stage === 'upload' ? 'Uploading' : 'Downloading'} ${Math.min(100, pct)}%`
                  : `Downloading remote file… ${formatFileSize(evt.loaded)}`
              );
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
    copyText(toDownloadPageUrl(url), 'Copied to clipboard');
  };

  const filteredUploadedFiles = useMemo(() => {
    const query = uploadedFilesSearch.trim().toLowerCase();

    return uploadedFiles.filter((file) => {
      const matchesSearch =
        !query ||
        file.filename.toLowerCase().includes(query) ||
        file.url.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (uploadedFilesFilter === 'all') return true;

      const ext = file.filename.split('.').pop()?.toLowerCase() || '';
      if (uploadedFilesFilter === 'images') return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
      if (uploadedFilesFilter === 'videos') return ['mp4', 'webm', 'mov', 'avi'].includes(ext);
      if (uploadedFilesFilter === 'documents') return ['pdf', 'doc', 'docx', 'txt', 'md', 'json'].includes(ext);

      return true;
    });
  }, [uploadedFiles, uploadedFilesSearch, uploadedFilesFilter]);

  // Files visible in the current drive folder, sorted.
  const driveFiles = useMemo(() => {
    const base = filteredUploadedFiles.filter(f => {
      const assigned = filesFolderMap[f.url];
      if (currentFolderId === null) {
        return !assigned || !folders.find(folder => folder.id === assigned);
      }
      return assigned === currentFolderId;
    });
    return [...base].sort((a, b) => {
      const nameA = displayNames[a.url] || formatDisplayName(a.filename);
      const nameB = displayNames[b.url] || formatDisplayName(b.filename);
      const extA = a.filename.split('.').pop()?.toLowerCase() || '';
      const extB = b.filename.split('.').pop()?.toLowerCase() || '';
      let cmp = 0;
      if (fileSort === 'name') cmp = nameA.localeCompare(nameB);
      else if (fileSort === 'date') cmp = a.timestamp - b.timestamp;
      else if (fileSort === 'size') cmp = (a.size || 0) - (b.size || 0);
      else if (fileSort === 'type') cmp = extA.localeCompare(extB);
      return fileSortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredUploadedFiles, filesFolderMap, folders, currentFolderId, fileSort, fileSortDir, displayNames]);

  return (
    <>
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
        {/* upload success cue: render directly above the logo instead of centered overlay */}

        {!uploading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.35rem',
          marginBottom: '0.1rem'
        }}>
          {uploadSuccessCue && !uploading && (
            <div style={{ width: 'min(100%, 460px)', marginBottom: '-8px', zIndex: 30 }}>
              <div className={`uploadSuccessCard${uploadSuccessCue.exiting ? ' uploadSuccessCard--exiting' : ''}`} style={{
                padding: '0.7rem 0.9rem',
                borderRadius: '12px',
                border: '1px solid rgba(79,248,192,0.28)',
                background: 'linear-gradient(135deg, rgba(79,248,192,0.12), rgba(255,255,255,0.04))',
                backdropFilter: 'blur(14px) saturate(140%)',
                WebkitBackdropFilter: 'blur(14px) saturate(140%)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                justifyContent: 'space-between',
                overflow: 'hidden',
                pointerEvents: 'auto',
                position: 'relative'
              }}>
                <div className="uploadSuccessSweep" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <MonoIcon name="check" className="monoIcon monoIcon--success" width={18} height={18} style={{ color: '#7ef4cb', flex: '0 0 auto' }} />
                  <div style={{ minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text)' }}>
                      {uploadSuccessCue.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#a9b2c1', wordBreak: 'break-all' }}>
                      {uploadSuccessCue.filename}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#7ef4cb', fontSize: '0.72rem', fontWeight: 700 }}>
                    <MonoIcon name="spark" className="monoIcon monoIcon--success" width={12} height={12} style={{ color: '#7ef4cb' }} />
                    Saved
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(126,244,203,0.6)', letterSpacing: '0.04em' }}>
                    {typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘C' : 'Ctrl+C'} to copy
                  </div>
                </div>
              </div>
            </div>
          )}
          <Image
            src={logo}
            alt="Logo"
            width={200}
            height={200}
               style={{
                 transform: 'translateY(-26px)',
                 animation: 'slideSide 12s cubic-bezier(0.4, 0, 0.2, 1) infinite'
               }}
          />
          <h1 style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: '1.45rem',
          fontWeight: 700,
          lineHeight: 1.42,
          letterSpacing: '-0.03em',
          color: 'var(--c-text)',
          animation: 'fadeSlideIn 1s ease-out',
          marginTop: '0.1rem',
          textAlign: 'center'
        }}>
          Quick, secure, and
          <br />
          seamless file sharing.
          </h1>
          <div
            style={{
              marginTop: '-0.35rem',
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
                fontSize: '0.7rem',
                color: 'rgba(181, 188, 201, 0.9)',
                letterSpacing: '0.01em'
              }}
            >
              {isPremium ? (
                <span style={{ color: 'var(--c-dim)' }}>
                  {premiumEmail || 'Active'}
                </span>
              ) : (
                <span style={{ color: 'var(--c-dim)' }}>
                  Premium = higher limits + no ads
                </span>
              )}
            </div>

            {isPremium ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <a
                  href="/premium/dashboard"
                  style={{
                    padding: '0.34rem 0.72rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.045)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: 'var(--c-text)',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.16)'
                  }}
                >
                  Dashboard
                </a>
                <button
                  onClick={logoutPremium}
                  style={{
                    padding: '0.34rem 0.72rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.045)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: 'var(--c-text)',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.16)'
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <a
                href="/premium"
              style={{
                  padding: '0.36rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(233,236,242,0.28)',
                  background: 'linear-gradient(180deg, rgba(233,236,242,0.16), rgba(233,236,242,0.11))',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  color: 'var(--c-text)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08)'
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
              color: 'var(--c-dim)',
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
              border: `1px dashed ${t.dragBorder}`,
              background: t.surface,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--c-text)',
              cursor: 'default',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
            }}
            className="drag-active"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
              <MonoIcon name="cloudUpload" className="monoIcon" width={20} height={20} />
              <span style={{ fontSize: '0.95rem', letterSpacing: '0.02em', fontWeight: 400 }}>
                {dragFileCount > 1 ? `Drop ${dragFileCount} files` : 'Drop to upload'}
              </span>
              {dragFileCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '0.15rem 0.5rem', borderRadius: '999px',
                  background: 'rgba(126,244,203,0.15)', border: '1px solid rgba(126,244,203,0.3)',
                  color: '#7ef4cb', fontSize: '0.7rem', fontWeight: 700
                }}>{dragFileCount}</span>
              )}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--c-dim)' }}>
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
                color: 'var(--c-text)',
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
              color: 'var(--c-text)',
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
              color: uploading ? 'rgba(255,255,255,0.35)' : 'var(--c-text)',
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
                color: 'var(--c-text)',
                background: t.input,
                border: `1px solid ${t.inputBorder}`,
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
                color: 'var(--c-text)',
                background: t.input,
                border: `1px solid ${t.inputBorder}`,
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
                color: 'var(--c-text)',
                background: t.input,
                border: `1px solid ${t.inputBorder}`,
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

          </div>
        )}

        {!uploading && (
        <p style={{
          marginTop: '0.85rem',
          fontSize: '0.6rem',
          color: 'var(--c-dim)',
          textAlign: 'center',
          letterSpacing: '0.02em'
        }}>
          {/* Max upload size: {formatFileSize(maxUploadBytes)} per file {isPremium ? '• Premium' : '• Free'} */}
        </p>
        )}

        {(uploadQueue.some(q => q.status === 'queued') || uploadQueue.some(q => q.status === 'uploading') || uploadQueue.some(q => q.status === 'error')) && (
          <div className="queue-panel">
            <div className="queue-panel__header">
              <div className="queue-panel__title">
                <div className="queue-panel__eyebrow">Queue</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {/* <div className="queue-panel__headline">Uploads</div> */}
                  <span className="queue-panel__count">
                    {uploadQueue.filter((q) => q.status === 'queued').length} waiting
                  </span>
                  {uploadQueue.some((q) => q.status === 'error') && (
                    <span className="queue-panel__count queue-panel__count--soft">
                      {uploadQueue.filter((q) => q.status === 'error').length} failed
                    </span>
                  )}
                </div>
              </div>
              <div className="queue-toolbar">
                <button
                  onClick={() => (queuePaused ? resumeQueue() : pauseQueue())}
                  className="queue-pill"
                  type="button"
                >
                  <MonoIcon name={queuePaused ? 'play' : 'pause'} className="monoIcon" width={12} height={12} />
                  {queuePaused ? 'Resume' : 'Pause'}
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
                  className="queue-pill queue-pill--soft"
                  type="button"
                  title="Remove successful items from the list"
                >
                  <MonoIcon name="close" className="monoIcon" width={12} height={12} />
                  Clear done
                </button>
              </div>
            </div>

            {uploading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                marginBottom: '0.9rem',
                padding: '0.85rem',
                borderRadius: '16px',
                border: `1px solid ${t.borderSub}`,
                background: t.progressBg,
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                flexWrap: 'wrap'
              }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    border: `1px solid ${t.inputBorder}`,
                    background: t.card,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--c-text)'
                  }}>
                    <MonoIcon name={uploadProgress >= 100 ? 'check' : 'cloudUpload'} className="monoIcon" width={14} height={14} />
                  </div>

                <div style={{ flex: '1 1 260px', minWidth: 0, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.78rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--c-text-ch),0.55)' }}>
                      Uploading now
                    </div>
                    <span className={`queue-status queue-status--uploading`} style={{ marginLeft: 0 }}>
                      {uploadProgress >= 100 ? 'Finalizing' : 'Uploading'}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.3rem', fontSize: '0.92rem', fontWeight: 600, color: 'var(--c-text)', wordBreak: 'break-all' }}>
                    {currentUploadName || 'Preparing upload…'}
                  </div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'rgba(var(--c-text-ch),0.64)' }}>
                    {uploadTotalBytes > 0
                      ? `${formatFileSize(uploadLoadedBytes)} / ${formatFileSize(uploadTotalBytes)}`
                      : uploadStatus || 'Starting upload…'}
                    {uploadQueue.some((q) => q.status === 'queued') && (
                      <> • {uploadQueue.filter((q) => q.status === 'queued').length} queued</>
                    )}
                  </div>
                  <div className="queue-progress" aria-hidden="true" style={{ marginTop: '0.55rem' }}>
                    <div
                      className="queue-progress__bar"
                      style={{ width: `${Math.min(100, uploadProgress)}%` }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={cancelUpload}
                    className="queue-pill queue-pill--soft"
                    type="button"
                    title="Cancel the active upload"
                  >
                    <MonoIcon name="close" className="monoIcon" width={12} height={12} />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="queue-list">
              {uploadQueue
                .slice()
                .sort((a, b) => a.addedAt - b.addedAt)
                .slice(0, 8)
                .map((item) => (
                  <div
                    key={item.id}
                    className="queue-item"
                  >
                    <div className="queue-item__body">
                      {item.status === 'success' && item.downloadUrl ? (
                        <a
                          href={toDownloadPageUrl(item.downloadUrl)}
                          className="queue-item__name queue-item__name--link"
                          title="Open download page"
                        >
                          {item.file.name}
                        </a>
                      ) : (
                        <div className="queue-item__name">
                          {item.file.name}
                        </div>
                      )}
                      <div className="queue-item__meta">
                        <span>{formatFileSize(item.file.size)}</span>
                        <span className={`queue-status queue-status--${item.status}`}>
                          {item.status === 'queued' ? (queuePaused ? 'Paused' : 'Queued') : item.status === 'success' ? 'Done' : item.status === 'error' ? 'Failed' : 'Uploading'}
                        </span>
                        {item.status === 'uploading' && typeof item.loadedBytes === 'number' && typeof item.totalBytes === 'number' && item.totalBytes > 0 && (
                          <>
                            <span>{Math.min(100, Math.round((item.loadedBytes / item.totalBytes) * 100))}%</span>
                            {(() => {
                              if (!item.startedAt || item.loadedBytes <= 0) return null;
                              const elapsed = Date.now() - item.startedAt;
                              if (elapsed < 3000) return null;
                              const bps = item.loadedBytes / elapsed;
                              if (bps <= 0) return null;
                              const remMs = (item.totalBytes - item.loadedBytes) / bps;
                              if (!isFinite(remMs) || remMs <= 0) return null;
                              const secs = Math.ceil(remMs / 1000);
                              return <span style={{ color: 'var(--c-dim)' }}>~{secs < 60 ? `${secs}s` : `${Math.ceil(secs / 60)}m`}</span>;
                            })()}
                          </>
                        )}
                        {item.status === 'error' && item.error && <span>{item.error}</span>}
                      </div>
                      {item.status === 'uploading' && typeof item.loadedBytes === 'number' && typeof item.totalBytes === 'number' && item.totalBytes > 0 && (
                        <div className="queue-progress" aria-hidden="true">
                          <div
                            className="queue-progress__bar"
                            style={{ width: `${Math.min(100, Math.round((item.loadedBytes / item.totalBytes) * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="queue-item__actions">
                      {item.status === 'error' && (
                        <button
                          onClick={() => retryQueueItem(item.id)}
                          className="queue-icon-btn"
                          title="Retry"
                          aria-label="Retry upload"
                          type="button"
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
                        className="queue-icon-btn"
                        style={{
                          color: item.status === 'uploading' ? 'rgba(var(--c-text-ch),0.35)' : 'var(--c-text)',
                          cursor: item.status === 'uploading' ? 'not-allowed' : 'pointer',
                        }}
                        title={item.status === 'uploading' ? 'Cannot remove while uploading' : 'Remove'}
                        aria-label="Remove from queue"
                        type="button"
                      >
                        <MonoIcon name="close" className="monoIcon" width={12} height={12} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {uploadQueue.length > 8 && (
              <div className="queue-footer-note">
                Showing first 8 items.
              </div>
            )}
          </div>
        )}

        {activeView === 'upload' && uploadedFiles.length > 0 && showUploadedFiles && (
          <div style={{ marginTop: '2rem', animation: 'fadeSlideIn 0.8s ease-out', width: '100%', maxWidth: '720px' }}>

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <button
                  onClick={() => setCurrentFolderId(null)}
                  style={{ background: 'none', border: 'none', padding: 0, color: currentFolderId ? 'var(--c-dim)' : 'var(--c-text)', cursor: currentFolderId ? 'pointer' : 'default', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit' }}
                >
                  Files
                </button>
                {currentFolderId && (() => {
                  const folder = folders.find(f => f.id === currentFolderId);
                  return folder ? (
                    <>
                      <span style={{ color: 'var(--c-dim)', opacity: 0.5 }}>›</span>
                      <span style={{ color: 'var(--c-text)' }}>{folder.name}</span>
                    </>
                  ) : null;
                })()}
                <span style={{ color: 'var(--c-dim)', fontWeight: 400, fontSize: '0.75rem' }}>
                  {driveFiles.length} {driveFiles.length === 1 ? 'item' : 'items'}
                  {filteredUploadedFiles.length < uploadedFiles.length ? ` of ${uploadedFiles.length}` : ''}
                </span>
              </div>

              {/* Right controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  value={uploadedFilesSearch}
                  onChange={e => setUploadedFilesSearch(e.target.value)}
                  placeholder="Search…"
                  style={{ width: '130px', padding: '0.38rem 0.65rem', borderRadius: '8px', border: `1px solid ${t.inputBorder}`, background: t.input, color: 'var(--c-text)', fontSize: '0.78rem', outline: 'none' }}
                />
                <select
                  value={uploadedFilesFilter}
                  onChange={e => setUploadedFilesFilter(e.target.value as typeof uploadedFilesFilter)}
                  style={{ padding: '0.38rem 0.55rem', borderRadius: '8px', border: `1px solid ${t.inputBorder}`, background: t.input, color: 'var(--c-text)', fontSize: '0.78rem', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="all">All</option>
                  <option value="images">Images</option>
                  <option value="videos">Videos</option>
                  <option value="documents">Docs</option>
                </select>
                <button
                  onClick={() => { setCreatingFolder(true); setNewFolderName(''); }}
                  title="New folder"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.28rem', padding: '0.38rem 0.65rem', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.surface, color: 'var(--c-text)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                  New folder
                </button>
                {/* View toggle */}
                <div style={{ display: 'flex', borderRadius: '8px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                  {(['list', 'grid'] as const).map(mode => (
                    <button key={mode} onClick={() => setFileViewMode(mode)} title={`${mode} view`}
                      style={{ padding: '0.38rem 0.5rem', background: fileViewMode === mode ? t.surface : 'transparent', border: 'none', borderRight: mode === 'list' ? `1px solid ${t.border}` : 'none', color: fileViewMode === mode ? 'var(--c-text)' : 'var(--c-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {mode === 'list'
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Panel ── */}
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>

              {/* Sort header — list view only */}
              {fileViewMode === 'list' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 68px 88px 80px', gap: '0.5rem', padding: '0.42rem 0.85rem', borderBottom: `1px solid ${t.borderSub}`, alignItems: 'center' }}>
                  {([['name','Name'],['type','Type'],['size','Size'],['date','Modified']] as const).map(([col, label]) => {
                    const active = fileSort === col;
                    return (
                      <button key={col} onClick={() => { if (active) setFileSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setFileSort(col); setFileSortDir(col === 'date' ? 'desc' : 'asc'); } }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', background: 'none', border: 'none', color: active ? 'var(--c-text)' : 'var(--c-dim)', fontSize: '0.68rem', fontWeight: active ? 700 : 500, cursor: 'pointer', padding: '0.1rem 0', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit' }}
                      >
                        {label}
                        {active && <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">{fileSortDir === 'asc' ? <path d="M5 2L9 8H1Z"/> : <path d="M5 8L1 2H9Z"/>}</svg>}
                      </button>
                    );
                  })}
                  <div/>
                </div>
              )}

              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>

                {/* New folder inline input */}
                {creatingFolder && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.65rem 0.85rem', borderBottom: `1px solid ${t.borderSub}` }}>
                    <svg width="16" height="14" viewBox="0 0 24 24" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { const n = newFolderName.trim(); if (n) setFolders(p => [...p, { id: `folder-${Date.now()}`, name: n }]); setCreatingFolder(false); setNewFolderName(''); } if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
                      onBlur={() => { const n = newFolderName.trim(); if (n) setFolders(p => [...p, { id: `folder-${Date.now()}`, name: n }]); setCreatingFolder(false); setNewFolderName(''); }}
                      placeholder="Folder name"
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--c-text)', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit' }}
                    />
                  </div>
                )}

                {/* Folders — root only */}
                {currentFolderId === null && folders.map(folder => {
                  const fileCount = Object.values(filesFolderMap).filter(v => v === folder.id).length;
                  const isRenaming = renamingFolderId === folder.id;
                  const rowStyle: React.CSSProperties = fileViewMode === 'list'
                    ? { display: 'grid', gridTemplateColumns: '1fr 52px 68px 88px 80px', gap: '0.5rem', padding: '0.62rem 0.85rem', borderBottom: `1px solid ${t.borderSub}`, cursor: 'pointer', transition: 'background 0.12s', alignItems: 'center' }
                    : { display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.62rem 0.85rem', borderBottom: `1px solid ${t.borderSub}`, cursor: 'pointer', transition: 'background 0.12s' };
                  return (
                    <div key={folder.id} style={rowStyle}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.surface; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}
                        onClick={() => !isRenaming && setCurrentFolderId(folder.id)}
                        onDoubleClick={e => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenameFolderValue(folder.name); }}
                      >
                        <svg width="17" height="15" viewBox="0 0 24 24" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        {isRenaming ? (
                          <input autoFocus value={renameFolderValue} onChange={e => setRenameFolderValue(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => { if (e.key === 'Enter') { const n = renameFolderValue.trim(); if (n) setFolders(p => p.map(f => f.id === folder.id ? { ...f, name: n } : f)); setRenamingFolderId(null); } if (e.key === 'Escape') setRenamingFolderId(null); }}
                            onBlur={() => { const n = renameFolderValue.trim(); if (n) setFolders(p => p.map(f => f.id === folder.id ? { ...f, name: n } : f)); setRenamingFolderId(null); }}
                            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--c-text)', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', padding: 0 }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                        )}
                      </div>
                      {fileViewMode === 'list' && (
                        <>
                          <span/>
                          <span style={{ fontSize: '0.72rem', color: 'var(--c-dim)' }}>{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
                          <span/>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.28rem', justifyContent: 'flex-end' }}>
                            <button onClick={e => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenameFolderValue(folder.name); }} title="Rename" style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={e => { e.stopPropagation(); setFolders(p => p.filter(f => f.id !== folder.id)); setFilesFolderMap(p => { const n = { ...p }; Object.keys(n).forEach(k => { if (n[k] === folder.id) delete n[k]; }); return n; }); }} title="Delete folder" style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid rgba(242,100,100,0.3)', background: 'rgba(242,100,100,0.07)', color: '#f26464', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <MonoIcon name="trash" width={9} height={9} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Empty state */}
                {driveFiles.length === 0 && !creatingFolder && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-dim)', fontSize: '0.82rem' }}>
                    {currentFolderId ? 'This folder is empty.' : uploadedFilesSearch ? 'No files match your search.' : 'No files here yet.'}
                  </div>
                )}

                {/* Files — list view */}
                {fileViewMode === 'list' && driveFiles.map(fileItem => {
                  const { filename, url } = fileItem;
                  const displayName = displayNames[url] || formatDisplayName(filename);
                  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
                  const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext || '');
                  const keyFromUrl = url.includes('/download/') ? url.split('/download/').pop() : url.includes('/d/') ? url.split('/d/').pop() : url.split('/').pop();
                  const thumbKey = keyFromUrl ? keyFromUrl.split('?')[0] : '';
                  const extLabel = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : 'FILE';
                  const isRenamingThis = renamingUrl === url;
                  const isMovingThis = movingFileUrl === url;
                  const assignedFolder = filesFolderMap[url];

                  return (
                    <div key={url} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 52px 68px 88px 80px', gap: '0.5rem', padding: '0.58rem 0.85rem', borderBottom: `1px solid ${t.borderSub}`, alignItems: 'center', transition: 'background 0.12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.surface; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                        {isImage && thumbKey
                          ? <img src={`/api/thumbnail?key=${encodeURIComponent(thumbKey)}&w=64&h=64`} alt="" loading="lazy" style={{ width: '26px', height: '26px', borderRadius: '5px', objectFit: 'cover', border: `1px solid ${t.border}`, flexShrink: 0 }} />
                          : <div style={{ width: '26px', height: '26px', borderRadius: '5px', background: t.surface, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.42rem', fontWeight: 700, color: 'var(--c-dim)', letterSpacing: '0.04em', flexShrink: 0 }}>{extLabel?.slice(0,4)}</div>
                        }
                        {isRenamingThis ? (
                          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { const n = renameValue.trim(); if (n) setDisplayNames(p => ({ ...p, [url]: n })); setRenamingUrl(null); } if (e.key === 'Escape') setRenamingUrl(null); }}
                            onBlur={() => { const n = renameValue.trim(); if (n) setDisplayNames(p => ({ ...p, [url]: n })); setRenamingUrl(null); }}
                            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--c-text)', fontSize: '0.84rem', fontWeight: 500, padding: 0, fontFamily: 'inherit' }}
                          />
                        ) : (
                          <span onDoubleClick={() => { setRenamingUrl(url); setRenameValue(displayName); }} title="Double-click to rename"
                            style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
                          >{displayName}</span>
                        )}
                      </div>
                      {/* Type */}
                      <span style={{ fontSize: '0.7rem', color: 'var(--c-dim)', fontWeight: 500 }}>{extLabel}</span>
                      {/* Size */}
                      <span style={{ fontSize: '0.71rem', color: 'var(--c-dim)' }}>{typeof fileItem.size === 'number' ? formatFileSize(fileItem.size) : '—'}</span>
                      {/* Date */}
                      <span style={{ fontSize: '0.71rem', color: 'var(--c-dim)' }}>{formatTimestamp(fileItem.timestamp)}</span>
                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.26rem', justifyContent: 'flex-end' }}>
                        <button onClick={e => { e.stopPropagation(); copyToClipboard(url); }} title="Copy link" style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <MonoIcon name="share" width={10} height={10} />
                        </button>
                        {/* Move to folder */}
                        <div style={{ position: 'relative' }}>
                          <button onClick={e => { e.stopPropagation(); setMovingFileUrl(isMovingThis ? null : url); }} title="Move to folder"
                            style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${isMovingThis ? 'rgba(251,191,36,0.5)' : t.border}`, background: isMovingThis ? 'rgba(251,191,36,0.12)' : 'transparent', color: isMovingThis ? 'rgba(251,191,36,0.9)' : 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          </button>
                          {isMovingThis && (
                            <div style={{ position: 'absolute', right: 0, top: '28px', zIndex: 100, background: isDark ? '#16162a' : '#ffffff', border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.3rem', minWidth: '150px', boxShadow: '0 8px 28px rgba(0,0,0,0.4)', backdropFilter: 'blur(14px)' }}>
                              {folders.length === 0 && <div style={{ padding: '0.45rem 0.65rem', fontSize: '0.74rem', color: 'var(--c-dim)' }}>No folders — create one first</div>}
                              {folders.map(folder => (
                                <button key={folder.id} onClick={e => { e.stopPropagation(); setFilesFolderMap(p => ({ ...p, [url]: folder.id })); setMovingFileUrl(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.4rem 0.6rem', background: assignedFolder === folder.id ? t.surface : 'transparent', border: 'none', borderRadius: '6px', color: 'var(--c-text)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                  <span style={{ flex: 1 }}>{folder.name}</span>
                                  {assignedFolder === folder.id && <span style={{ color: '#7ef4cb', fontSize: '0.65rem' }}>✓</span>}
                                </button>
                              ))}
                              {assignedFolder && (
                                <button onClick={e => { e.stopPropagation(); setFilesFolderMap(p => { const n = { ...p }; delete n[url]; return n; }); setMovingFileUrl(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.4rem 0.6rem', background: 'transparent', border: 'none', borderRadius: '6px', color: 'var(--c-dim)', fontSize: '0.74rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', marginTop: '0.15rem', borderTop: `1px solid ${t.borderSub}` }}
                                >
                                  Remove from folder
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Delete */}
                        <button onClick={e => { e.stopPropagation(); deleteUploadedFile(url); }} disabled={deletingUrls.has(url)} title="Delete"
                          style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid rgba(242,100,100,0.3)', background: 'rgba(242,100,100,0.07)', color: deletingUrls.has(url) ? 'rgba(242,100,100,0.4)' : '#f26464', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: deletingUrls.has(url) ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                        >
                          {deletingUrls.has(url) ? <span style={{ fontSize: '0.55rem' }}>…</span> : <MonoIcon name="trash" width={9} height={9} />}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Files — grid view */}
                {fileViewMode === 'grid' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', padding: '0.7rem' }}>
                    {/* Folder cards */}
                    {currentFolderId === null && folders.map(folder => (
                      <div key={folder.id} onDoubleClick={() => setCurrentFolderId(folder.id)}
                        style={{ borderRadius: '10px', border: `1px solid ${t.border}`, background: t.surface, padding: '0.7rem 0.6rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', transition: 'background 0.12s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.card; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.surface; }}
                      >
                        <svg width="34" height="30" viewBox="0 0 24 24" fill="rgba(251,191,36,0.18)" stroke="rgba(251,191,36,0.85)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--c-text)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{folder.name}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--c-dim)' }}>{Object.values(filesFolderMap).filter(v => v === folder.id).length} files</span>
                      </div>
                    ))}
                    {/* File cards */}
                    {driveFiles.map(fileItem => {
                      const { filename, url } = fileItem;
                      const displayName = displayNames[url] || formatDisplayName(filename);
                      const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
                      const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext || '');
                      const keyFromUrl = url.includes('/download/') ? url.split('/download/').pop() : url.includes('/d/') ? url.split('/d/').pop() : url.split('/').pop();
                      const thumbKey = keyFromUrl ? keyFromUrl.split('?')[0] : '';
                      const extLabel = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : 'FILE';
                      const isRenamingThis = renamingUrl === url;
                      return (
                        <div key={url} style={{ borderRadius: '10px', border: `1px solid ${t.border}`, background: t.surface, padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative', transition: 'background 0.12s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.card; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.surface; }}
                        >
                          {isImage && thumbKey
                            ? <img src={`/api/thumbnail?key=${encodeURIComponent(thumbKey)}&w=200&h=200`} alt="" loading="lazy" style={{ width: '100%', height: '72px', objectFit: 'cover', borderRadius: '6px', border: `1px solid ${t.border}` }} />
                            : <div style={{ width: '100%', height: '72px', borderRadius: '6px', background: t.card, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700, color: 'var(--c-dim)', letterSpacing: '0.06em' }}>{extLabel?.slice(0,5)}</div>
                          }
                          {isRenamingThis ? (
                            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { const n = renameValue.trim(); if (n) setDisplayNames(p => ({ ...p, [url]: n })); setRenamingUrl(null); } if (e.key === 'Escape') setRenamingUrl(null); }}
                              onBlur={() => { const n = renameValue.trim(); if (n) setDisplayNames(p => ({ ...p, [url]: n })); setRenamingUrl(null); }}
                              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--c-text)', fontSize: '0.7rem', fontWeight: 600, padding: 0, width: '100%', textAlign: 'center', fontFamily: 'inherit' }}
                            />
                          ) : (
                            <span onDoubleClick={() => { setRenamingUrl(url); setRenameValue(displayName); }} title="Double-click to rename"
                              style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', cursor: 'text' }}
                            >{displayName}</span>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.28rem' }}>
                            <button onClick={e => { e.stopPropagation(); copyToClipboard(url); }} title="Copy link" style={{ width: '22px', height: '22px', borderRadius: '5px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><MonoIcon name="share" width={9} height={9} /></button>
                            <button onClick={e => { e.stopPropagation(); setQrPopoverUrl(toDownloadPageUrl(url)); }} title="QR code" style={{ width: '22px', height: '22px', borderRadius: '5px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><MonoIcon name="qrCode" width={9} height={9} /></button>
                            <button onClick={e => { e.stopPropagation(); deleteUploadedFile(url); }} disabled={deletingUrls.has(url)} title="Delete" style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid rgba(242,100,100,0.3)', background: 'rgba(242,100,100,0.07)', color: '#f26464', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><MonoIcon name="trash" width={9} height={9} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
              color: 'var(--c-text)'
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
              color: 'var(--c-dim)',
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
              color: 'var(--c-dim)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)'
            }}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: '0.75rem' }}>
                <MonoIcon
                  name={emptyMessages[emptyMessageIndex].icon}
                  className="monoIcon"
                  width={28}
                  height={28}
                  style={{ color: 'var(--c-text)' }}
                />
                <div style={{ color: 'var(--c-text)', fontSize: '0.9rem', fontWeight: 600 }}>
                  {emptyMessages[emptyMessageIndex].title}
                </div>
                <div style={{ maxWidth: '28rem', lineHeight: 1.5, fontSize: '0.78rem', color: 'var(--c-dim)' }}>
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
                            color: 'var(--c-text)',
                            fontWeight: 500,
                            wordBreak: 'break-all'
                          }}>
                            {formatDisplayName(record.filename)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--c-dim)'
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
                          color: 'var(--c-text)',
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
                        color: 'var(--c-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Size
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--c-sub)'
                      }}>
                        {formatFileSize(record.size)}
                      </div>


                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--c-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Link
                      </div>
                      <a 
                        href={record.url.includes('/d/') || record.url.includes('/download/') ? record.url : `${window.location.origin}/download/${record.url.split('/').pop()}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: 'var(--c-sub)',
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
                  {remoteUploading && (
                    <div
                      style={{
                        position: 'fixed',
                        bottom: '2rem',
                        right: '2rem',
                        width: '320px',
                        borderRadius: '16px',
                        background: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '1.2rem',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                        zIndex: 1000,
                        animation: 'fadeSlideIn 0.3s ease-out'
                      }}
                    >
                      <div style={{ marginBottom: '0.8rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f5f5f5', marginBottom: '0.4rem' }}>
                          Remote Upload
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)' }}>
                          {remoteStage === 'download' && 'Downloading file…'}
                          {remoteStage === 'server' && 'Fetching server-side…'}
                          {remoteStage === 'enqueue' && 'Queued for upload…'}
                        </div>
                      </div>

                      {remoteStage === 'download' && (
                        <div style={{ marginBottom: '0.8rem' }}>
                          <div style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '999px',
                            overflow: 'hidden',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{
                              height: '100%',
                              background: 'linear-gradient(90deg, #4ff8c0 0%, #5ee7f4 100%)',
                              width: `${remoteTotalBytes ? Math.min(100, Math.round((remoteDownloadedBytes / remoteTotalBytes) * 100)) : 0}%`,
                              transition: 'width 0.2s ease'
                            }}/>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(var(--c-dim-ch),0.75)', textAlign: 'center' }}>
                            {remoteTotalBytes
                              ? `${Math.min(100, Math.round((remoteDownloadedBytes / remoteTotalBytes) * 100))}% • ${formatFileSize(remoteDownloadedBytes)} / ${formatFileSize(remoteTotalBytes)}`
                              : `${formatFileSize(remoteDownloadedBytes)}`}
                          </div>
                        </div>
                      )}

                      {(remoteStage === 'server' || remoteStage === 'enqueue') && (
                        <div style={{
                          fontSize: '0.72rem',
                          color: 'rgba(var(--c-dim-ch),0.75)',
                          textAlign: 'center',
                          padding: '0.4rem 0'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            animation: 'spin 0.8s linear infinite',
                            animationDelay: '0s'
                          }}>⟳</span>
                          <span style={{ marginLeft: '0.3rem' }}>Processing…</span>
                        </div>
                      )}
                    </div>
                  )}
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
              color: 'var(--c-dim)',
              margin: 0
            }}>
              Showing {publicHistory.length} recent uploads {verifyingFiles ? '• Verifying files...' : ''}
            </p>
          </div>
        </div>
        )}

        {/* Toast Notifications Stack */}
        {toasts.length > 0 && (
          <div
            onMouseEnter={() => setToastsExpanded(true)}
            onMouseLeave={() => setToastsExpanded(false)}
            style={{
              position: 'fixed',
              bottom: '1.25rem',
              right: '1.25rem',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: toastsExpanded ? '0.5rem' : '0',
              width: toastsExpanded ? 'auto' : '320px',
              transition: 'gap 0.2s ease',
              cursor: toasts.length > 1 ? 'pointer' : 'default'
            }}
          >
            {toasts.slice(Math.max(0, toasts.length - 3)).map((toast, idx) => {
              const isHidden = !toastsExpanded && idx < Math.max(0, toasts.length - 3);
              const stackOffset = idx * (toastsExpanded ? 0 : 6);
              return (
                <div
                  key={toast.id}
                  style={{
                    background: 'rgba(20,22,27,0.7)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    color: 'var(--c-text)',
                    padding: '0.65rem 0.95rem',
                    borderRadius: '10px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    animation: 'fadeSlideIn 0.25s ease-out',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    display: isHidden && !toastsExpanded ? 'none' : 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: toastsExpanded ? 1 : 0.95,
                    transform: toastsExpanded ? 'translateX(0)' : `translateX(${stackOffset}px) translateY(${stackOffset}px)`,
                    transition: 'all 0.2s ease',
                    minWidth: '280px'
                  }}
                >
                  <MonoIcon
                    name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'warning' : 'spark'}
                    className={toast.type === 'success' ? 'monoIcon monoIcon--success' : 'monoIcon'}
                    width={14}
                    height={14}
                    style={{ color: toast.type === 'success' ? '#7ef4cb' : toast.type === 'error' ? '#f2c6c6' : 'var(--c-text)', flexShrink: 0 }}
                  />
                  <span>{toast.message}</span>
                </div>
              );
            })}
          </div>
        )}

        {activeView === 'upload' && uploadedFiles.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUploadedFiles((prev) => !prev)}
            className="footer-link footer-link--show-files"
            aria-expanded={showUploadedFiles}
            aria-controls="uploaded-files-list"
            style={{
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              opacity: showUploadedFiles ? 1 : 0.92,
            }}
          >
            {showUploadedFiles ? 'Hide files' : `Show files (${uploadedFiles.length})`}
          </button>
        )}
      </main>

      {/* Feature 5: QR code popover */}
      {qrPopoverUrl && (
        <div
          className="qr-popover-backdrop"
          onClick={() => setQrPopoverUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="QR code"
        >
          <div className="qr-popover" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text)', textAlign: 'center' }}>
              Scan to open
            </div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code"
                width={200}
                height={200}
                style={{ borderRadius: '10px', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '200px', height: '200px', display: 'grid', placeItems: 'center',
                borderRadius: '10px', background: 'rgba(255,255,255,0.05)'
              }}>
                <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', fontSize: '1.5rem' }}>⟳</span>
              </div>
            )}
            <div style={{
              fontSize: '0.65rem', color: 'var(--c-dim)', wordBreak: 'break-all',
              textAlign: 'center', maxWidth: '200px'
            }}>
              {qrPopoverUrl}
            </div>
            <button
              onClick={() => setQrPopoverUrl(null)}
              style={{
                padding: '0.4rem 1.2rem', borderRadius: '999px', fontSize: '0.75rem',
                border: `1px solid ${t.border}`, background: t.surface,
                color: 'var(--c-text)', cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
