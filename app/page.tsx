'use client';

import { useMemo, useState, useRef, useEffect, type SVGProps } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
// import AdBanner from './components/AdBanner';
import logo from './logo.png';
import { useTheme } from './components/ThemeProvider';
import LordIcon from './components/LordIcon';
import type { LordIconName } from './lib/lordicons';

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

// Icons with an animated Lordicon equivalent available (see app/lib/lordicons.ts for
// sourcing notes). Names left out (folder, pause, play, sun, moon, qrCode) have no
// reasonable open Lordicon match, or are paired in a toggle with a name that doesn't
// (play/pause, sun/moon), so the original static glyph was kept for both sides.
const MONO_LORD_ICON: Partial<Record<MonoIconName, LordIconName>> = {
  cloudUpload: 'rocket',
  spark: 'bolt',
  warning: 'warning',
  check: 'checkmark',
  arrowLeft: 'arrowRight',
  refresh: 'spinner',
  retry: 'spinner',
  close: 'cross',
  share: 'link',
  trash: 'trash',
};
const MONO_LORD_ICON_MIRROR: Partial<Record<MonoIconName, true>> = { arrowLeft: true };

function MonoIcon({
  name,
  className,
  ...props
}: { name: MonoIconName; className?: string } & SVGProps<SVGSVGElement>) {
  const lordIconName = MONO_LORD_ICON[name];
  if (lordIconName) {
    const size = typeof props.width === 'number' ? props.width : 16;
    return (
      <LordIcon
        name={lordIconName}
        size={size}
        mirror={MONO_LORD_ICON_MIRROR[name]}
        className={className}
        style={props.style}
      />
    );
  }

  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
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
    default:
      return null;
  }
}

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
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [showBulkMoveMenu, setShowBulkMoveMenu] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [replacingUrls, setReplacingUrls] = useState<Set<string>>(new Set());
  const replaceTargetUrlRef = useRef<string | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

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

  // Folders are server-backed now (so they can be shared — see /api/folders
  // and /folder/[code]) rather than purely client-local. Folder *assignment*
  // (filesFolderMap) and display names stay in localStorage for instant
  // rendering, but assignment changes are also pushed to the server via
  // updateFileMetadata so the shared-folder view stays in sync.
  useEffect(() => {
    fetch('/api/folders')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.data?.folders)) setFolders(data.data.folders);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    try {
      const m = localStorage.getItem('relay:filesFolderMap');
      if (m) setFilesFolderMap(JSON.parse(m));
      const n = localStorage.getItem('relay:displayNames');
      if (n) setDisplayNames(JSON.parse(n));
    } catch {}
  }, []);
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
              const res = await fetch(`/dl/${encodeURIComponent(key)}`, { method: 'HEAD', cache: 'no-store' });
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
      const res = await fetch('/api/dedupe', {
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
      if (res.status === 422) {
        const payload = await res.json().catch(() => ({}));
        if (payload?.quarantined) {
          throw new Error(payload?.error || 'This file was flagged as malicious and cannot be shared.');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('malicious')) {
        throw err;
      }
      // Otherwise best effort — dedupe registration failing shouldn't fail the upload.
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

      lastSuccessUrlRef.current = downloadPageUrl;
      return;
    }

    // Always use multipart for true resume-after-refresh.
    let multipart = item.multipart;

    if (!multipart) {
      const randomFilename = generateRandomFilename(file.name);
      const pathname = randomFilename;
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
    const newUrl = `${window.location.origin}/d/${uploadedFilename}`;
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

    try {
      await commitFileHash(contentHash, multipart.objectKey, file);
    } catch (err) {
      // Malware flagged post-upload: the object stays in R2/history under
      // quarantine (blocked at the /d/, /dl/, and /p/ routes) for admin
      // review, but it shouldn't appear as a usable link in this browser.
      setUploadedFiles((prev) => prev.filter((f) => f.url !== newUrl));
      throw err;
    }
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

      // '/download/' is the legacy page prefix (still resolvable via a
      // redirect); '/d/' is the current page. Either way, the key is the same.
      if (cleanPath.includes('/download/')) {
        const key = cleanPath.split('/download/')[1] || '';
        return `${base}/d/${key}`;
      }

      if (cleanPath.includes('/d/')) {
        const key = cleanPath.split('/d/')[1] || '';
        return `${base}/d/${key}`;
      }

      const tail = cleanPath.split('/').filter(Boolean).pop() || '';
      return `${base}/d/${tail}`;
    } catch {
      const tail = rawUrl.split('/').filter(Boolean).pop() || '';
      return `${base}/d/${tail}`;
    }
  };

  const toCdnUrl = (rawUrl: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      const parsed = new URL(rawUrl, base || 'http://localhost');
      const cleanPath = parsed.pathname.replace(/\/+$/, '');
      if (cleanPath.includes('/download/')) {
        const key = cleanPath.split('/download/')[1] || '';
        return `${base}/p/${key}`;
      }
      if (cleanPath.includes('/d/')) {
        const key = cleanPath.split('/d/')[1] || '';
        return `${base}/p/${key}`;
      }
      if (cleanPath.includes('/p/')) {
        return `${base}${cleanPath}`;
      }
      const tail = cleanPath.split('/').filter(Boolean).pop() || '';
      return `${base}/p/${tail}`;
    } catch {
      const tail = rawUrl.split('/').filter(Boolean).pop() || '';
      return `${base}/p/${tail}`;
    }
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

  // Persists folder/displayName changes to the server (PATCH /api/history).
  // Errors are surfaced via toast but don't roll back the optimistic change
  // made by the caller — retrying the same action re-sends the same patch.
  const updateFileMetadata = async (
    url: string,
    patch: { folder?: string | null; displayName?: string | null }
  ) => {
    try {
      const res = await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...patch }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to update file');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update file', 'error');
    }
  };

  // Folders live on the server (app/api/folders) so they can be shared —
  // these wrap the CRUD calls and keep local `folders` state in sync.
  const createFolderApi = async (name: string) => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to create folder');
      setFolders((prev) => [payload.data.folder, ...prev]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create folder', 'error');
    }
  };

  const renameFolderApi = async (id: string, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to rename folder');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename folder', 'error');
    }
  };

  const deleteFolderApi = async (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setFilesFolderMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (next[k] === id) delete next[k]; });
      return next;
    });
    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete folder');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete folder', 'error');
    }
  };

  const shareFolderApi = async (id: string) => {
    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.data?.shareCode) throw new Error(payload?.error || 'Failed to share folder');
      const link = `${window.location.origin}/folder/${payload.data.shareCode}`;
      await navigator.clipboard.writeText(link);
      showToast('Folder link copied!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to share folder', 'error');
    }
  };

  // Move (or unassign) a file to a folder — updates the fast local cache and
  // persists to the server so the shared-folder view reflects it too.
  const assignFileToFolder = (url: string, folderId: string | null) => {
    setFilesFolderMap((prev) => {
      const next = { ...prev };
      if (folderId) next[url] = folderId;
      else delete next[url];
      return next;
    });
    updateFileMetadata(url, { folder: folderId });
  };

  const toggleSelected = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const runBulkAction = async (payload: Record<string, unknown>) => {
    const urls = Array.from(selectedUrls);
    if (urls.length === 0) return;
    setBulkWorking(true);
    try {
      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, ...payload }),
      });
      const responsePayload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responsePayload?.error || 'Bulk action failed');

      if (payload.action === 'delete') {
        setUploadedFiles((prev) => prev.filter((f) => !selectedUrls.has(f.url)));
      } else if (payload.action === 'move') {
        const folder = payload.folder as string | null;
        setFilesFolderMap((prev) => {
          const next = { ...prev };
          urls.forEach((u) => { if (folder) next[u] = folder; else delete next[u]; });
          return next;
        });
      }

      showToast('Bulk action complete', 'success');
      setSelectedUrls(new Set());
      setShowBulkMoveMenu(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk action failed', 'error');
    } finally {
      setBulkWorking(false);
    }
  };

  // "Replace file" — overwrites the R2 object at the same key a fresh PUT,
  // so the download link stays identical. This is a straight overwrite, not
  // version history: the previous bytes aren't retained anywhere.
  const requestReplaceFile = (url: string) => {
    replaceTargetUrlRef.current = url;
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileSelected = async (file: File) => {
    const url = replaceTargetUrlRef.current;
    if (!url) return;
    setReplacingUrls((prev) => new Set(prev).add(url));
    try {
      const presignRes = await fetch('/api/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, contentType: file.type || 'application/octet-stream' }),
      });
      const presignPayload = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok || !presignPayload?.data?.uploadUrl) {
        throw new Error(presignPayload?.error || 'Failed to prepare replacement upload');
      }

      const putRes = await fetch(presignPayload.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error('Failed to upload replacement file');
      }

      await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, size: file.size }),
      }).catch(() => {});

      setUploadedFiles((prev) => prev.map((f) => (f.url === url ? { ...f, size: file.size, timestamp: Date.now() } : f)));
      showToast('File replaced', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to replace file', 'error');
    } finally {
      setReplacingUrls((prev) => { const next = new Set(prev); next.delete(url); return next; });
      replaceTargetUrlRef.current = null;
    }
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
      const nameA = displayNames[a.url] || a.filename;
      const nameB = displayNames[b.url] || b.filename;
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

        <input
          ref={replaceFileInputRef}
          type="file"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleReplaceFileSelected(f); e.target.value = ''; }}
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
          {/* Remote Upload — secondary */}
          <button
            onClick={() => {
              setShowRemoteUpload((v) => !v);
              setActiveView('upload');
            }}
            style={{
              fontFamily: "'Sora', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.52rem 1.2rem',
              fontSize: '0.81rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
              color: showRemoteUpload ? 'var(--c-text)' : 'var(--c-dim)',
              background: showRemoteUpload ? 'rgba(255,255,255,0.1)' : 'transparent',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: showRemoteUpload ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.11)',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.22s',
              boxShadow: showRemoteUpload ? '0 2px 12px rgba(0,0,0,0.22)' : 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = 'var(--c-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = showRemoteUpload ? 'rgba(255,255,255,0.1)' : 'transparent';
              e.currentTarget.style.borderColor = showRemoteUpload ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.11)';
              e.currentTarget.style.color = showRemoteUpload ? 'var(--c-text)' : 'var(--c-dim)';
            }}
          >
            {remoteUploading
              ? <><LordIcon name="spinner" trigger="loop" size={12} />Uploading…</>
              : <><LordIcon name="copy" size={12} />Remote URL</>}
          </button>

          {/* Choose File — primary */}
          <button
            onClick={() => {
              setActiveView('upload');
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            style={{
              fontFamily: "'Sora', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.52rem 1.35rem',
              fontSize: '0.81rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: uploading ? 'rgba(255,255,255,0.3)' : isDark ? '#0a0a0a' : '#ffffff',
              background: uploading
                ? 'rgba(255,255,255,0.06)'
                : isDark
                  ? 'rgba(233,236,242,0.92)'
                  : 'rgba(20,20,20,0.88)',
              border: uploading
                ? '1px solid rgba(255,255,255,0.08)'
                : isDark
                  ? '1px solid rgba(255,255,255,0.12)'
                  : '1px solid rgba(0,0,0,0.12)',
              borderRadius: '50px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.22s',
              boxShadow: uploading ? 'none' : isDark ? '0 2px 18px rgba(233,236,242,0.15), 0 1px 0 rgba(255,255,255,0.1) inset' : '0 2px 18px rgba(0,0,0,0.18)',
            }}
            onMouseEnter={(e) => {
              if (!uploading) {
                e.currentTarget.style.background = isDark ? 'rgba(233,236,242,1)' : 'rgba(10,10,10,0.96)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = isDark ? '0 4px 22px rgba(233,236,242,0.22)' : '0 4px 22px rgba(0,0,0,0.25)';
              }
            }}
            onMouseLeave={(e) => {
              if (!uploading) {
                e.currentTarget.style.background = isDark ? 'rgba(233,236,242,0.92)' : 'rgba(20,20,20,0.88)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isDark ? '0 2px 18px rgba(233,236,242,0.15)' : '0 2px 18px rgba(0,0,0,0.18)';
              }
            }}
          >
            {uploading
              ? <><LordIcon name="spinner" trigger="loop" size={12} />Uploading…</>
              : <><LordIcon name="rocket" size={12} />Choose File</>}
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
                      {item.status === 'success' && item.downloadUrl && (
                        <>
                          <button
                            onClick={() => copyToClipboard(item.downloadUrl!)}
                            className="queue-icon-btn"
                            title="Copy download page link"
                            aria-label="Copy download page link"
                            type="button"
                          >
                            <LordIcon name="link" size={12} />
                          </button>
                          <button
                            onClick={() => copyText(toCdnUrl(item.downloadUrl!), 'CDN link copied!')}
                            className="queue-icon-btn"
                            title="Copy CDN link (direct URL for use as src)"
                            aria-label="Copy CDN link"
                            type="button"
                          >
                            <LordIcon name="network" size={12} />
                          </button>
                        </>
                      )}
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

            {/* ── Bulk action bar ── */}
            {selectedUrls.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', marginBottom: '0.6rem', borderRadius: '10px', border: '1px solid rgba(126,244,203,0.3)', background: 'rgba(126,244,203,0.08)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#7ef4cb' }}>{selectedUrls.size} selected</span>
                <div style={{ position: 'relative' }}>
                  <button disabled={bulkWorking} onClick={() => setShowBulkMoveMenu(v => !v)}
                    style={{ fontSize: '0.75rem', padding: '0.32rem 0.6rem', borderRadius: '7px', border: `1px solid ${t.border}`, background: t.surface, color: 'var(--c-text)', cursor: 'pointer' }}
                  >Move to folder</button>
                  {showBulkMoveMenu && (
                    <div style={{ position: 'absolute', left: 0, top: '30px', zIndex: 100, background: isDark ? '#16162a' : '#ffffff', border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.3rem', minWidth: '160px', boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
                      {folders.length === 0 && <div style={{ padding: '0.45rem 0.65rem', fontSize: '0.74rem', color: 'var(--c-dim)' }}>No folders yet</div>}
                      {folders.map(folder => (
                        <button key={folder.id} onClick={() => runBulkAction({ action: 'move', folder: folder.id })}
                          style={{ display: 'block', width: '100%', padding: '0.4rem 0.6rem', background: 'transparent', border: 'none', borderRadius: '6px', color: 'var(--c-text)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                        >{folder.name}</button>
                      ))}
                      <button onClick={() => runBulkAction({ action: 'move', folder: null })}
                        style={{ display: 'block', width: '100%', padding: '0.4rem 0.6rem', background: 'transparent', border: 'none', borderRadius: '6px', color: 'var(--c-dim)', fontSize: '0.74rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', marginTop: '0.15rem', borderTop: `1px solid ${t.borderSub}` }}
                      >Remove from folder</button>
                    </div>
                  )}
                </div>
                <button disabled={bulkWorking} onClick={() => { if (confirm(`Delete ${selectedUrls.size} file(s)?`)) runBulkAction({ action: 'delete' }); }}
                  style={{ fontSize: '0.75rem', padding: '0.32rem 0.6rem', borderRadius: '7px', border: '1px solid rgba(242,100,100,0.3)', background: 'rgba(242,100,100,0.07)', color: '#f26464', cursor: 'pointer' }}
                >Delete</button>
                <button onClick={() => setSelectedUrls(new Set())} style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--c-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear</button>
              </div>
            )}

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
                      onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
                      onBlur={() => { const n = newFolderName.trim(); if (n) createFolderApi(n); setCreatingFolder(false); setNewFolderName(''); }}
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
                      onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = 'rgba(126,244,203,0.1)'; }}
                      onDragLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      onDrop={e => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        const draggedUrl = e.dataTransfer.getData('text/plain');
                        if (draggedUrl) assignFileToFolder(draggedUrl, folder.id);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}
                        onClick={() => !isRenaming && setCurrentFolderId(folder.id)}
                        onDoubleClick={e => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenameFolderValue(folder.name); }}
                      >
                        <svg width="17" height="15" viewBox="0 0 24 24" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        {isRenaming ? (
                          <input autoFocus value={renameFolderValue} onChange={e => setRenameFolderValue(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') setRenamingFolderId(null); }}
                            onBlur={() => { const n = renameFolderValue.trim(); if (n) renameFolderApi(folder.id, n); setRenamingFolderId(null); }}
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
                            <button onClick={e => { e.stopPropagation(); shareFolderApi(folder.id); }} title="Copy shareable folder link" style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <LordIcon name="copy" size={10} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenameFolderValue(folder.name); }} title="Rename" style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <LordIcon name="pencil" size={10} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteFolderApi(folder.id); }} title="Delete folder" style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid rgba(242,100,100,0.3)', background: 'rgba(242,100,100,0.07)', color: '#f26464', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
                  const displayName = displayNames[url] || filename;
                  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
                  const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext || '');
                  const keyFromUrl = url.includes('/download/') ? url.split('/download/').pop() : url.includes('/d/') ? url.split('/d/').pop() : url.split('/').pop();
                  const thumbKey = keyFromUrl ? keyFromUrl.split('?')[0] : '';
                  const extLabel = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : 'FILE';
                  const isRenamingThis = renamingUrl === url;
                  const isMovingThis = movingFileUrl === url;
                  const assignedFolder = filesFolderMap[url];

                  return (
                    <div key={url} draggable onDragStart={e => e.dataTransfer.setData('text/plain', url)}
                      style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 52px 68px 88px 80px', gap: '0.5rem', padding: '0.58rem 0.85rem', borderBottom: `1px solid ${t.borderSub}`, alignItems: 'center', transition: 'background 0.12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.surface; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                        <input type="checkbox" checked={selectedUrls.has(url)} onClick={e => e.stopPropagation()} onChange={() => toggleSelected(url)}
                          style={{ flexShrink: 0, width: '13px', height: '13px', cursor: 'pointer', accentColor: '#7ef4cb' }}
                        />
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
                        <button onClick={e => { e.stopPropagation(); copyToClipboard(url); }} title="Copy share link" style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <MonoIcon name="share" width={10} height={10} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); copyText(toCdnUrl(url), 'CDN link copied!'); }} title="Copy CDN link (direct URL for use as src)" style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <LordIcon name="copy" size={10} />
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
                                <button key={folder.id} onClick={e => { e.stopPropagation(); assignFileToFolder(url, folder.id); setMovingFileUrl(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.4rem 0.6rem', background: assignedFolder === folder.id ? t.surface : 'transparent', border: 'none', borderRadius: '6px', color: 'var(--c-text)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                  <span style={{ flex: 1 }}>{folder.name}</span>
                                  {assignedFolder === folder.id && <span style={{ color: '#7ef4cb', fontSize: '0.65rem' }}>✓</span>}
                                </button>
                              ))}
                              {assignedFolder && (
                                <button onClick={e => { e.stopPropagation(); assignFileToFolder(url, null); setMovingFileUrl(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.4rem 0.6rem', background: 'transparent', border: 'none', borderRadius: '6px', color: 'var(--c-dim)', fontSize: '0.74rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', marginTop: '0.15rem', borderTop: `1px solid ${t.borderSub}` }}
                                >
                                  Remove from folder
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Replace */}
                        <button onClick={e => { e.stopPropagation(); requestReplaceFile(url); }} disabled={replacingUrls.has(url)} title="Replace file (overwrites in place, no version history)"
                          style={{ width: '24px', height: '24px', borderRadius: '6px', border: `1px solid ${t.border}`, background: 'transparent', color: 'var(--c-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: replacingUrls.has(url) ? 'not-allowed' : 'pointer' }}
                        >
                          {replacingUrls.has(url) ? <span style={{ fontSize: '0.55rem' }}>…</span> : <LordIcon name="spinner" size={10} />}
                        </button>
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
                      const displayName = displayNames[url] || filename;
                      const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
                      const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext || '');
                      const keyFromUrl = url.includes('/download/') ? url.split('/download/').pop() : url.includes('/d/') ? url.split('/d/').pop() : url.split('/').pop();
                      const thumbKey = keyFromUrl ? keyFromUrl.split('?')[0] : '';
                      const extLabel = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : 'FILE';
                      const isRenamingThis = renamingUrl === url;
                      return (
                        <div key={url} draggable onDragStart={e => e.dataTransfer.setData('text/plain', url)}
                          style={{ borderRadius: '10px', border: `1px solid ${t.border}`, background: t.surface, padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative', transition: 'background 0.12s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.card; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.surface; }}
                        >
                          <input type="checkbox" checked={selectedUrls.has(url)} onClick={e => e.stopPropagation()} onChange={() => toggleSelected(url)}
                            style={{ position: 'absolute', top: '0.45rem', left: '0.45rem', zIndex: 2, width: '13px', height: '13px', cursor: 'pointer', accentColor: '#7ef4cb' }}
                          />
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
