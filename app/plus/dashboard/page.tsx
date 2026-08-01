'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '@/app/logo.png';
import SnippetEditor from '@/app/components/SnippetEditor';
import { languageFromFilename } from '@/app/lib/lang-map';
import { PLUS_STORAGE_LIMIT_BYTES } from '@/app/lib/plan-limits';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  lastAccessTime: number;
  expiresAt: number;
  size: number;
  folder?: string;
  displayName?: string;
  kind?: 'file' | 'snippet';
  language?: string;
}

interface FolderRecord {
  id: string;
  name: string;
  createdAt: number;
}

const UNFILED = '__unfiled__';

type IconName = 'upload' | 'folder' | 'code' | 'copy' | 'refresh' | 'file' | 'search' | 'menu' | 'grid' | 'key' | 'book';

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  switch (name) {
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 15V4M12 4l-4 4M12 4l4 4" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
      );
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
      );
    case 'code':
      return (
        <svg {...common}>
          <path d="m8 6-6 6 6 6" />
          <path d="m16 6 6 6-6 6" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...common}>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
      );
    case 'file':
      return (
        <svg {...common}>
          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
          <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case 'key':
      return (
        <svg {...common}>
          <circle cx="7.5" cy="15.5" r="4.5" />
          <path d="m10.6 12.4 8.4-8.4M16 3l3 3M13.5 8l2 2" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
          <path d="M4 19a2 2 0 0 1 2-2h13" />
        </svg>
      );
  }
}

function Spinner({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBadge({ name, tone = 'mint' }: { name: IconName; tone?: 'mint' | 'blue' }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        borderRadius: '9px',
        flexShrink: 0,
        background: tone === 'blue' ? 'rgba(96,165,250,0.14)' : 'rgba(126,244,203,0.14)',
        color: tone === 'blue' ? '#60a5fa' : 'var(--c-accent-mint)',
      }}
    >
      <Icon name={name} size={15} />
    </span>
  );
}

function StatusDot({ active, tone = 'mint' }: { active: boolean; tone?: 'mint' | 'error' }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
        background: tone === 'error' ? 'var(--c-accent-error)' : 'var(--c-accent-mint)',
        boxShadow: active ? `0 0 0 3px ${tone === 'error' ? 'rgba(255,158,158,0.18)' : 'rgba(126,244,203,0.18)'}` : 'none',
        animation: active ? 'pulseDot 1.3s ease-in-out infinite' : 'none',
        transition: 'box-shadow 0.3s ease, background 0.3s ease',
      }}
    />
  );
}

export default function PlusDashboard() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [movingUrl, setMovingUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mountedRef = useRef(false);
  const syncRequestIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [snippetContent, setSnippetContent] = useState('');
  const [snippetFilename, setSnippetFilename] = useState('');
  const [snippetSubmitting, setSnippetSubmitting] = useState(false);
  const snippetLanguage = useMemo(() => languageFromFilename(snippetFilename), [snippetFilename]);

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/folders', { cache: 'no-store' });
      const data = await res.json();
      if (data?.success) {
        setFolders(data.data.folders || []);
      }
    } catch {
      // Non-fatal: folder grid just stays as-is until the next successful sync.
    }
  };

  const syncAll = async (initial = false) => {
    const requestId = ++syncRequestIdRef.current;
    try {
      if (mountedRef.current) {
        if (initial) setLoading(true);
        else setSyncing(true);
        setError(null);
      }

      const meResponse = await fetch('/api/plus/me', { cache: 'no-store' });
      if (!mountedRef.current || requestId !== syncRequestIdRef.current) return;
      const me = await meResponse.json();
      if (!me?.plus) {
        window.location.href = '/plus';
        return;
      }
      setUserEmail(me?.user?.email || '');

      const [uploadsResponse] = await Promise.all([
        fetch('/api/plus/uploads', { cache: 'no-store' }),
        loadFolders(),
      ]);
      if (!mountedRef.current || requestId !== syncRequestIdRef.current) return;
      if (!uploadsResponse.ok) {
        throw new Error('Failed to load uploads');
      }

      const data = await uploadsResponse.json();
      if (mountedRef.current && requestId === syncRequestIdRef.current) {
        setUploads(data.uploads || []);
        setLastSynced(Date.now());
      }
    } catch (err) {
      if (mountedRef.current && requestId === syncRequestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load uploads');
      }
    } finally {
      if (mountedRef.current && requestId === syncRequestIdRef.current) {
        if (initial) setLoading(false);
        else setSyncing(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void syncAll(true);
    const interval = window.setInterval(() => void syncAll(false), 30000);
    const handleFocus = () => void syncAll(false);
    window.addEventListener('focus', handleFocus);

    // Diagnostic only: lets a persistence problem (folders/uploads not
    // sticking) be recognized here instead of looking like a random bug.
    fetch('/api/plus/health', { cache: 'no-store' })
      .then((res) => res.json())
      .then((status) => {
        if (mountedRef.current) setStorageWarning(!status?.ok);
      })
      .catch(() => {});

    return () => {
      mountedRef.current = false;
      syncRequestIdRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const copyAllLinks = async () => {
    if (uploads.length === 0) return;
    const links = uploads.map((file) => file.url).join('\n');
    await navigator.clipboard.writeText(links);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1200);
  };

  const deleteUpload = async (url: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      setDeletingUrl(url);
      const response = await fetch('/api/plus/uploads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to delete upload');
      setUploads((current) => current.filter((item) => item.url !== url));
    } catch {
      alert('Failed to delete upload');
    } finally {
      setDeletingUrl(null);
    }
  };

  const assignFolder = async (url: string, folderId: string | null) => {
    setMovingUrl(url);
    try {
      const response = await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, folder: folderId }),
      });
      if (!response.ok) throw new Error('Failed to move file');
      setUploads((current) => current.map((f) => (f.url === url ? { ...f, folder: folderId || undefined } : f)));
    } catch {
      alert('Failed to move file to folder');
    } finally {
      setMovingUrl(null);
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Failed to create folder');
      setFolders((prev) => [data.data.folder, ...prev]);
      setNewFolderName('');
      setCreatingFolder(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadingCount((c) => c + files.length);

    for (const file of files) {
      try {
        const random = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const safeName = file.name.replace(/[/\\]/g, '-');
        const pathname = `d/${random}-${safeName}`;
        const contentType = file.type || 'application/octet-stream';

        const initRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pathname, contentType, size: file.size, filename: file.name }),
        });
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error(initData?.error || 'Failed to start upload');

        const putRes = await fetch(initData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        });
        if (!putRes.ok) throw new Error('Upload failed');

        const downloadUrl = `${window.location.origin}/d/${initData.pathname}`;
        const historyRes = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: downloadUrl, filename: file.name, size: file.size }),
        });
        if (!historyRes.ok) throw new Error('Failed to save upload');

        if (selectedFolderId) {
          await fetch('/api/history', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: downloadUrl, folder: selectedFolderId }),
          });
        }
      } catch (err) {
        alert(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }

    void syncAll(false);
  };

  const submitSnippet = async () => {
    const content = snippetContent.trim();
    if (!content || snippetSubmitting) return;

    setSnippetSubmitting(true);
    try {
      const res = await fetch('/api/snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: snippetContent,
          language: snippetLanguage,
          filename: snippetFilename.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to create snippet');

      if (selectedFolderId && payload?.record?.url) {
        await fetch('/api/history', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload.record.url, folder: selectedFolderId }),
        });
      }

      setSnippetContent('');
      setSnippetFilename('');
      setShowSnippetModal(false);
      void syncAll(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create snippet');
    } finally {
      setSnippetSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch('/api/plus/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const folderCounts = new Map<string, { count: number; size: number }>();
  let unfiledCount = 0;
  let unfiledSize = 0;
  for (const file of uploads) {
    if (file.folder) {
      const entry = folderCounts.get(file.folder) || { count: 0, size: 0 };
      entry.count += 1;
      entry.size += file.size || 0;
      folderCounts.set(file.folder, entry);
    } else {
      unfiledCount += 1;
      unfiledSize += file.size || 0;
    }
  }

  const visibleUploads = uploads
    .filter((file) => {
      if (selectedFolderId === UNFILED) return !file.folder;
      if (selectedFolderId) return file.folder === selectedFolderId;
      return true;
    })
    .filter((file) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return file.filename.toLowerCase().includes(q) || (file.displayName?.toLowerCase().includes(q) ?? false);
    });

  const totalBytes = uploads.reduce((sum, file) => sum + (file.size || 0), 0);
  const storagePct = Math.min(100, (totalBytes / PLUS_STORAGE_LIMIT_BYTES) * 100);
  const isBusy = syncing || loading || uploadingCount > 0;
  const statusLabel = uploadingCount > 0
    ? `Uploading ${uploadingCount} file${uploadingCount === 1 ? '' : 's'}…`
    : lastSynced
      ? `Synced ${new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : 'Syncing…';

  const glass = {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
  };

  return (
    <>
      <style jsx>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.82); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes uploadBarSlide {
          0% { left: -35%; }
          100% { left: 100%; }
        }
        .pressable { transition: transform 0.14s ease, opacity 0.14s ease; will-change: transform; }
        .pressable:active { transform: scale(0.96); }
        .navItem:hover, .folderItem:hover { background: var(--surface-hover) !important; }
        .actionCard:hover { background: var(--surface-hover) !important; border-color: var(--border-strong) !important; }
        .dropzone { transition: border-color 0.15s ease, background 0.15s ease; }
        .fileList { transition: opacity 0.3s ease; }
        @media (max-width: 480px) {
          .actionGrid { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important; gap: 0.5rem !important; }
        }
      `}</style>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
        }}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(ellipse at 30% 20%, var(--wash-violet) 0%, var(--wash-base) 55%), radial-gradient(ellipse at 75% 80%, var(--wash-teal) 0%, var(--wash-base) 60%)',
          backgroundAttachment: 'fixed',
          color: 'var(--c-text)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.target.value = ''; }}
        />

        {/* Global upload progress indicator — fixed to the viewport so it's
            visible the same way on mobile (above the sticky top bar) and
            desktop (above everything else), regardless of scroll position. */}
        <div
          aria-hidden={uploadingCount === 0}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 60,
            overflow: 'hidden', pointerEvents: 'none', background: 'transparent',
            opacity: uploadingCount > 0 ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
        >
          <div
            style={{
              position: 'absolute', top: 0, left: '-35%', height: '100%', width: '35%',
              background: 'linear-gradient(90deg, transparent, var(--c-accent-mint), transparent)',
              animation: uploadingCount > 0 ? 'uploadBarSlide 1.1s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        {/* Mobile top bar: gives narrow viewports a way to reach the sidebar,
            which is otherwise an always-visible 240px column that would eat
            most of the screen width if left in the row layout below. */}
        <div
          className="flex lg:hidden"
          style={{
            position: 'sticky', top: 0, zIndex: 20, alignItems: 'center', gap: '0.7rem',
            // Right padding clears the fixed global theme toggle (top-right,
            // 40px wide at right: 1.25rem — see ThemeToggle.tsx), which
            // otherwise sits on top of the storage pill below.
            padding: '0.9rem 3.4rem 0.9rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--background)',
          }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={sidebarOpen}
            className="pressable"
            style={{
              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-input)',
              background: 'var(--surface-input)', color: 'var(--c-text)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Icon name="menu" size={16} />
          </button>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
            <Image src={logo} alt="" width={18} height={18} style={{ borderRadius: '5px', flexShrink: 0 }} />
            <div style={{ fontSize: '1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Relay</div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: '999px', background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--c-sub)', fontSize: '0.65rem' }}>
            <StatusDot active={isBusy} tone={error ? 'error' : 'mint'} />
            {formatFileSize(totalBytes)}
          </div>
        </div>

        {sidebarOpen && (
          <div
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', top: '62px', right: 0, bottom: 0, left: 0, zIndex: 30, background: 'rgba(0,0,0,0.45)' }}
          />
        )}

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-[62px] lg:top-0 z-40 lg:z-10 h-[calc(100vh-62px)] lg:h-screen transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          style={{
            width: '240px',
            flexShrink: 0,
            overflowY: 'auto',
            // Extra bottom padding keeps "Log out" clear of the global fixed
            // Policy/Pricing/API pills (see globals.css .footer-link), which
            // float over whatever sits at the bottom of the viewport.
            padding: '1.4rem 1rem calc(1.4rem + 2.75rem)',
            borderRight: '1px solid var(--border-subtle)',
            background: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.4rem',
          }}
        >
          <div>
            <Link href="/" className="pressable" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: 'fit-content', textDecoration: 'none', color: 'inherit' }}>
              <Image src={logo} alt="" width={20} height={20} style={{ borderRadius: '5px', flexShrink: 0 }} />
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Relay</div>
            </Link>
            <div style={{
              display: 'inline-block',
              marginTop: '0.3rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              background: 'rgba(126,244,203,0.14)',
              color: 'var(--c-accent-mint)',
            }}>
              PLUS VAULT
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div className="navItem" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.6rem', borderRadius: '8px', background: 'var(--surface-card-strong)', fontSize: '0.82rem', fontWeight: 600 }}>
              <Icon name="grid" size={14} /> Dashboard
            </div>
            <Link href="/api" className="navItem pressable" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--c-sub)', textDecoration: 'none' }}>
              <Icon name="key" size={14} /> API keys
            </Link>
            <Link href="/docs" className="navItem pressable" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--c-sub)', textDecoration: 'none' }}>
              <Icon name="book" size={14} /> Docs
            </Link>
          </nav>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--c-dim)' }}>
                Folders
              </div>
              <button
                onClick={() => setCreatingFolder((v) => !v)}
                className="pressable"
                title="New folder"
                style={{ width: '18px', height: '18px', borderRadius: '5px', border: '1px solid var(--border-input)', background: 'var(--surface-input)', color: 'var(--c-sub)', fontSize: '0.75rem', lineHeight: 1, cursor: 'pointer' }}
              >
                +
              </button>
            </div>

            {creatingFolder && (
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void createFolder(); if (e.key === 'Escape') setCreatingFolder(false); }}
                  placeholder="Folder name"
                  style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-input)', background: 'var(--surface-input)', color: 'var(--c-text)', fontSize: '0.75rem', outline: 'none' }}
                />
                <button onClick={createFolder} className="pressable" style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: 'none', background: 'rgba(var(--c-text-ch),0.18)', color: 'var(--c-text)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  Add
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflowY: 'auto' }}>
              <button
                onClick={() => { setSelectedFolderId(null); setSidebarOpen(false); }}
                className="folderItem pressable"
                style={{
                  display: 'flex', justifyContent: 'space-between', textAlign: 'left', padding: '0.4rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: selectedFolderId === null ? 'var(--surface-card-strong)' : 'transparent',
                  color: selectedFolderId === null ? 'var(--c-text)' : 'var(--c-sub)', fontSize: '0.78rem',
                }}
              >
                <span>All files</span>
                <span style={{ color: 'var(--c-dim)' }}>{uploads.length}</span>
              </button>
              <button
                onClick={() => { setSelectedFolderId(UNFILED); setSidebarOpen(false); }}
                className="folderItem pressable"
                style={{
                  display: 'flex', justifyContent: 'space-between', textAlign: 'left', padding: '0.4rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: selectedFolderId === UNFILED ? 'var(--surface-card-strong)' : 'transparent',
                  color: selectedFolderId === UNFILED ? 'var(--c-text)' : 'var(--c-sub)', fontSize: '0.78rem',
                }}
              >
                <span>Unfiled</span>
                <span style={{ color: 'var(--c-dim)' }}>{unfiledCount}</span>
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => { setSelectedFolderId(folder.id); setSidebarOpen(false); }}
                  className="folderItem pressable"
                  style={{
                    display: 'flex', justifyContent: 'space-between', textAlign: 'left', padding: '0.4rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    background: selectedFolderId === folder.id ? 'var(--surface-card-strong)' : 'transparent',
                    color: selectedFolderId === folder.id ? 'var(--c-text)' : 'var(--c-sub)', fontSize: '0.78rem',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                  <span style={{ color: 'var(--c-dim)', flexShrink: 0, marginLeft: '0.4rem' }}>{folderCounts.get(folder.id)?.count || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-dim)' }}>
                Storage used
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--c-dim)' }}>{storagePct.toFixed(storagePct < 1 ? 2 : 0)}%</div>
            </div>
            <div style={{ height: '5px', borderRadius: '999px', background: 'var(--surface-input)', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div
                className="fileList"
                style={{
                  height: '100%',
                  width: `${storagePct}%`,
                  borderRadius: '999px',
                  background: storagePct > 90 ? 'var(--c-accent-error)' : 'var(--c-accent-mint)',
                  transition: 'width 0.4s ease',
                  opacity: syncing ? 0.7 : 1,
                }}
              />
            </div>
            <div className="fileList" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.7rem', opacity: syncing ? 0.7 : 1 }}>
              {formatFileSize(totalBytes)} <span style={{ fontWeight: 400, color: 'var(--c-dim)', fontSize: '0.7rem' }}>of {formatFileSize(PLUS_STORAGE_LIMIT_BYTES)}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--c-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.4rem' }}>
              {userEmail}
            </div>
            <button
              onClick={logout}
              className="pressable"
              style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--c-sub)', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left' }}
            >
              Log out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="dropzone" style={{
          flex: 1,
          minWidth: 0,
          padding: '2.2rem clamp(1.2rem, 4vw, 3rem)',
          border: isDragOver ? '2px dashed rgba(126,244,203,0.5)' : '2px dashed transparent',
          borderRadius: isDragOver ? '18px' : 0,
          margin: isDragOver ? '0.5rem' : 0,
        }}>
          {storageWarning && (
            <div style={{
              marginBottom: '1.2rem', padding: '0.65rem 0.9rem', borderRadius: '10px',
              border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)',
              color: '#f2c879', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span aria-hidden="true">⚠</span>
              No persistent storage configured for this account — folders and uploads may not survive a server
              restart. Set <code style={{ fontFamily: 'ui-monospace, monospace' }}>SUPABASE_URL</code> and{' '}
              <code style={{ fontFamily: 'ui-monospace, monospace' }}>SUPABASE_SERVICE_ROLE_KEY</code> in your deployment to fix this.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.6rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 3.4vw, 1.9rem)' }}>Welcome back</h1>
              <p style={{ margin: '0.3rem 0 0', color: 'var(--c-sub)', fontSize: '0.85rem' }}>{userEmail}</p>
            </div>
            {/* lg:mr-14 reserves space for the fixed global theme toggle
                (top-right, see app/components/ThemeToggle.tsx) so it never
                sits on top of this row — only matters on desktop, since on
                mobile this row sits below the sticky top bar instead. */}
            <div className="lg:mr-14" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 260px', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: '280px' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-dim)', display: 'flex', pointerEvents: 'none' }}>
                  <Icon name="search" size={13} />
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files"
                  style={{ width: '100%', padding: '0.55rem 0.85rem 0.55rem 2rem', borderRadius: '999px', border: '1px solid var(--border-input)', background: 'var(--surface-input)', color: 'var(--c-text)', fontSize: '0.78rem', outline: 'none' }}
                />
              </div>
              <div className="hidden lg:flex" style={{ alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '999px', ...glass, color: 'var(--c-sub)', fontSize: '0.7rem' }}>
                <StatusDot active={isBusy} tone={error ? 'error' : 'mint'} />
                {statusLabel}
              </div>
            </div>
          </div>

          {/* Action cards */}
          <div className="actionGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.7rem', marginBottom: '1.8rem' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="actionCard pressable"
              style={{ ...glass, display: 'flex', alignItems: 'center', gap: '0.7rem', borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}
            >
              {uploadingCount > 0 ? (
                <span
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                    background: 'rgba(126,244,203,0.14)', color: 'var(--c-accent-mint)',
                  }}
                >
                  <Spinner size={15} />
                </span>
              ) : (
                <IconBadge name="upload" />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  Upload files
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>
                  {uploadingCount > 0 ? `Uploading ${uploadingCount}…` : 'or drop anywhere'}
                </div>
              </div>
            </button>
            <button
              onClick={() => setCreatingFolder(true)}
              className="actionCard pressable"
              style={{ ...glass, display: 'flex', alignItems: 'center', gap: '0.7rem', borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}
            >
              <IconBadge name="folder" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>New folder</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>Organize your files</div>
              </div>
            </button>
            <button
              onClick={() => setShowSnippetModal(true)}
              className="actionCard pressable"
              style={{ ...glass, display: 'flex', alignItems: 'center', gap: '0.7rem', borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}
            >
              <IconBadge name="code" tone="blue" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>New snippet</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>Paste and share code</div>
              </div>
            </button>
            <button
              onClick={copyAllLinks}
              disabled={uploads.length === 0}
              className="actionCard pressable"
              style={{ ...glass, display: 'flex', alignItems: 'center', gap: '0.7rem', borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: uploads.length === 0 ? 'default' : 'pointer', color: 'var(--c-text)', opacity: uploads.length === 0 ? 0.5 : 1 }}
            >
              <IconBadge name="copy" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{copiedAll ? 'Copied!' : 'Copy all links'}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>{uploads.length} file{uploads.length === 1 ? '' : 's'}</div>
              </div>
            </button>
            <button
              onClick={() => syncAll(false)}
              className="actionCard pressable"
              style={{ ...glass, display: 'flex', alignItems: 'center', gap: '0.7rem', borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}
            >
              <IconBadge name="refresh" />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  Refresh
                  <StatusDot active={syncing} tone="mint" />
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>{formatFileSize(totalBytes)} stored</div>
              </div>
            </button>
          </div>

          {/* Folder grid */}
          {folders.length > 0 && (
            <div style={{ marginBottom: '1.8rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.7rem' }}>All folders</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.7rem' }}>
                {folders.map((folder) => {
                  const stats = folderCounts.get(folder.id) || { count: 0, size: 0 };
                  const isSelected = selectedFolderId === folder.id;
                  return (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolderId(isSelected ? null : folder.id)}
                      className="actionCard pressable"
                      style={{
                        ...glass,
                        borderColor: isSelected ? 'rgba(126,244,203,0.4)' : 'var(--border-default)',
                        background: isSelected ? 'rgba(126,244,203,0.08)' : 'var(--surface-card)',
                        borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isSelected ? 'var(--c-accent-mint)' : 'var(--c-dim)' }}>
                        <Icon name="folder" size={14} />
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text)' }}>
                          {folder.name}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.3rem' }}>
                        {stats.count} file{stats.count === 1 ? '' : 's'} · {formatFileSize(stats.size)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* File list */}
          <div style={{ ...glass, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderRadius: '18px', padding: '1.3rem', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {selectedFolderId === UNFILED ? 'Unfiled' : selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name || 'Folder' : 'All files'}
                {selectedFolderId === UNFILED && unfiledSize > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--c-dim)', marginLeft: '0.5rem' }}>· {formatFileSize(unfiledSize)}</span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--c-dim)' }}>{visibleUploads.length} visible</div>
            </div>

            {loading ? (
              <div style={{ color: 'var(--c-dim)', fontSize: '0.85rem' }}>Loading uploads…</div>
            ) : error ? (
              <div style={{ color: 'var(--c-accent-error)', fontSize: '0.85rem' }}>{error}</div>
            ) : visibleUploads.length === 0 ? (
              <div style={{ padding: '2rem 1.2rem', borderRadius: '14px', border: '1px dashed var(--border-strong)', color: 'var(--c-sub)', textAlign: 'center', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ color: 'var(--c-dim)' }}>
                  <Icon name={uploads.length === 0 ? 'upload' : 'search'} size={22} />
                </div>
                {uploads.length === 0
                  ? 'No uploads yet. Drop a file anywhere on this page, or use "Upload files" above.'
                  : 'No files match this view.'}
              </div>
            ) : (
              <div className="fileList" style={{ display: 'grid', gap: '0.6rem', opacity: syncing ? 0.75 : 1 }}>
                {visibleUploads.map((file, index) => (
                  <div
                    key={`${file.url}-${index}`}
                    style={{
                      minWidth: 0,
                      padding: '0.75rem 0.9rem', borderRadius: '12px', border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-well)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0, flex: '1 1 240px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: file.kind === 'snippet' ? 'rgba(96,165,250,0.14)' : 'var(--surface-input)',
                        color: file.kind === 'snippet' ? '#60a5fa' : 'var(--c-sub)',
                      }}>
                        <Icon name={file.kind === 'snippet' ? 'code' : 'file'} size={15} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div
                            title={file.displayName || file.filename}
                            style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                          >
                            {file.displayName || file.filename}
                          </div>
                          {file.kind === 'snippet' && (
                            <span style={{
                              flexShrink: 0, padding: '0.1rem 0.4rem', borderRadius: '999px',
                              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em',
                              background: 'rgba(96,165,250,0.14)', color: '#60a5fa',
                            }}>
                              {file.language ? file.language.toUpperCase() : 'SNIPPET'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.25rem' }}>
                          {formatFileSize(file.size)} · {formatTimestamp(file.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={file.folder || ''}
                        disabled={movingUrl === file.url}
                        onChange={(e) => assignFolder(file.url, e.target.value || null)}
                        style={{ padding: '0.32rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-input)', background: 'var(--surface-input)', color: 'var(--c-sub)', fontSize: '0.68rem', outline: 'none' }}
                      >
                        <option value="">No folder</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <a href={file.url} target="_blank" rel="noreferrer" className="pressable" style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', border: '1px solid var(--border-input)', background: 'var(--surface-card-strong)', color: 'var(--c-text)', textDecoration: 'none', fontSize: '0.68rem' }}>
                        Open
                      </a>
                      <button onClick={() => navigator.clipboard.writeText(file.url)} className="pressable" style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(var(--c-text-ch),0.4)', background: 'rgba(var(--c-text-ch),0.16)', color: 'var(--c-text)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                        Copy
                      </button>
                      <button
                        onClick={() => deleteUpload(file.url, file.filename)}
                        disabled={deletingUrl === file.url}
                        className="pressable"
                        style={{
                          padding: '0.35rem 0.7rem', borderRadius: '999px',
                          border: deletingUrl === file.url ? '1px solid var(--border-subtle)' : '1px solid rgba(255,158,158,0.35)',
                          background: deletingUrl === file.url ? 'var(--surface-card)' : 'rgba(255,158,158,0.12)',
                          color: deletingUrl === file.url ? 'var(--c-dim)' : 'var(--c-accent-error-strong)', fontSize: '0.68rem', fontWeight: 700,
                          cursor: deletingUrl === file.url ? 'default' : 'pointer',
                        }}
                      >
                        {deletingUrl === file.url ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
        </div>

        {showSnippetModal && (
          <div
            onClick={() => {
              if (snippetSubmitting) return;
              if (snippetContent.trim().length > 0 && !window.confirm('Discard this snippet?')) return;
              setShowSnippetModal(false);
            }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: '1.2rem',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                ...glass, borderRadius: '16px', width: 'min(560px, 100%)', display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,0.4)', background: 'var(--surface-card-strong)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>New snippet</div>
                <button
                  onClick={() => {
                    if (snippetContent.trim().length > 0 && !window.confirm('Discard this snippet?')) return;
                    setShowSnippetModal(false);
                  }}
                  className="pressable"
                  style={{ border: 'none', background: 'transparent', color: 'var(--c-dim)', fontSize: '1rem', cursor: 'pointer', lineHeight: 1, padding: '0.2rem' }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <input
                  value={snippetFilename}
                  onChange={(e) => setSnippetFilename(e.target.value)}
                  placeholder="filename.ext (optional)"
                  disabled={snippetSubmitting}
                  style={{ padding: '0.5rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border-input)', background: 'var(--surface-input)', color: 'var(--c-text)', fontSize: '0.78rem', outline: 'none' }}
                />

                <SnippetEditor
                  code={snippetContent}
                  onChange={setSnippetContent}
                  language={snippetLanguage}
                  placeholder="Paste your code here…"
                  disabled={snippetSubmitting}
                  height="260px"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', padding: '0.9rem 1.1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => {
                    if (snippetContent.trim().length > 0 && !window.confirm('Discard this snippet?')) return;
                    setShowSnippetModal(false);
                  }}
                  disabled={snippetSubmitting}
                  className="pressable"
                  style={{ padding: '0.5rem 0.9rem', borderRadius: '999px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--c-sub)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitSnippet}
                  disabled={snippetSubmitting || snippetContent.trim().length === 0}
                  className="pressable"
                  style={{
                    padding: '0.5rem 1rem', borderRadius: '999px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                    color: snippetSubmitting || snippetContent.trim().length === 0 ? 'var(--c-dim)' : '#0a0a0a',
                    background: snippetSubmitting || snippetContent.trim().length === 0 ? 'var(--surface-input)' : 'var(--c-accent-mint)',
                    cursor: snippetSubmitting || snippetContent.trim().length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {snippetSubmitting ? 'Creating…' : 'Create snippet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
