'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  lastAccessTime: number;
  expiresAt: number;
  size: number;
  folder?: string;
}

interface FolderRecord {
  id: string;
  name: string;
  createdAt: number;
}

const UNFILED = '__unfiled__';

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
  const mountedRef = useRef(false);
  const syncRequestIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      return file.filename.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const totalBytes = uploads.reduce((sum, file) => sum + (file.size || 0), 0);
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
        .pressable { transition: transform 0.14s ease, opacity 0.14s ease; will-change: transform; }
        .pressable:active { transform: scale(0.96); }
        .navItem:hover, .folderItem:hover { background: var(--surface-hover) !important; }
        .actionCard:hover { background: var(--surface-hover) !important; border-color: var(--border-strong) !important; }
        .dropzone { transition: border-color 0.15s ease, background 0.15s ease; }
        .fileList { transition: opacity 0.3s ease; }
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
          background: 'radial-gradient(ellipse at 30% 20%, var(--wash-violet) 0%, var(--wash-base) 55%), radial-gradient(ellipse at 75% 80%, var(--wash-teal) 0%, var(--wash-base) 60%)',
          backgroundAttachment: 'fixed',
          color: 'var(--c-text)',
          fontFamily: "'Sora', sans-serif",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.target.value = ''; }}
        />

        {/* Sidebar */}
        <aside
          style={{
            width: '240px',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
            padding: '1.4rem 1rem',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.4rem',
          }}
        >
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Relay</div>
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
            <div className="navItem" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', background: 'var(--surface-card-strong)', fontSize: '0.82rem', fontWeight: 600 }}>
              Home
            </div>
            <Link href="/" className="navItem pressable" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--c-sub)', textDecoration: 'none' }}>
              Upload
            </Link>
            <Link href="/api" className="navItem pressable" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--c-sub)', textDecoration: 'none' }}>
              API keys
            </Link>
            <Link href="/docs" className="navItem pressable" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--c-sub)', textDecoration: 'none' }}>
              Docs
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
                onClick={() => setSelectedFolderId(null)}
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
                onClick={() => setSelectedFolderId(UNFILED)}
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
                  onClick={() => setSelectedFolderId(folder.id)}
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
            <div style={{ fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: '0.2rem' }}>
              Storage used
            </div>
            <div className="fileList" style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.7rem', opacity: syncing ? 0.7 : 1 }}>
              {formatFileSize(totalBytes)}
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
            {/* marginRight reserves space for the fixed global theme toggle
                (top-right, see app/components/ThemeToggle.tsx) so it never
                sits on top of the search/status row at narrower viewports. */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginRight: '3.5rem' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files"
                style={{ padding: '0.55rem 0.85rem', borderRadius: '999px', border: '1px solid var(--border-input)', background: 'var(--surface-input)', color: 'var(--c-text)', fontSize: '0.78rem', outline: 'none', width: '200px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '999px', ...glass, color: 'var(--c-sub)', fontSize: '0.7rem' }}>
                <StatusDot active={isBusy} tone={error ? 'error' : 'mint'} />
                {statusLabel}
              </div>
            </div>
          </div>

          {/* Action cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem', marginBottom: '1.8rem' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                + Upload files
                {uploadingCount > 0 && <StatusDot active tone="mint" />}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>
                {uploadingCount > 0 ? `Uploading ${uploadingCount}…` : 'or drop anywhere'}
              </div>
            </button>
            <button
              onClick={() => setCreatingFolder(true)}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>+ New folder</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>Organize your files</div>
            </button>
            <button
              onClick={copyAllLinks}
              disabled={uploads.length === 0}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: uploads.length === 0 ? 'default' : 'pointer', color: 'var(--c-text)', opacity: uploads.length === 0 ? 0.5 : 1 }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{copiedAll ? 'Copied!' : 'Copy all links'}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>{uploads.length} file{uploads.length === 1 ? '' : 's'}</div>
            </button>
            <button
              onClick={() => syncAll(false)}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Refresh
                <StatusDot active={syncing} tone="mint" />
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>{formatFileSize(totalBytes)} stored</div>
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
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {folder.name}
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
              <div style={{ padding: '1.2rem', borderRadius: '14px', border: '1px dashed var(--border-strong)', color: 'var(--c-sub)', textAlign: 'center', fontSize: '0.82rem' }}>
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
                      padding: '0.75rem 0.9rem', borderRadius: '12px', border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-well)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, wordBreak: 'break-all' }}>{file.filename}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginTop: '0.25rem' }}>
                        {formatFileSize(file.size)} · {formatTimestamp(file.timestamp)}
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
    </>
  );
}
