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
      // Non-fatal: folder grid just stays empty.
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
  const syncedLabel = loading
    ? 'Loading'
    : syncing
      ? 'Refreshing'
      : lastSynced
        ? `Synced ${new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'Not synced';

  const glass = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <>
      <style jsx>{`
        .pressable { transition: transform 0.14s ease, opacity 0.14s ease; will-change: transform; }
        .pressable:active { transform: scale(0.96); }
        .navItem:hover, .folderItem:hover { background: rgba(255,255,255,0.06) !important; }
        .actionCard:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.2) !important; }
        .dropzone { transition: border-color 0.15s ease, background 0.15s ease; }
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
          background: 'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
          backgroundAttachment: 'fixed',
          color: '#eef1f6',
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
            borderRight: '1px solid rgba(255,255,255,0.08)',
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
              background: 'rgba(79,248,192,0.14)',
              color: '#7ef4cb',
            }}>
              PLUS VAULT
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div className="navItem" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', fontSize: '0.82rem', fontWeight: 600 }}>
              Home
            </div>
            <Link href="/" className="navItem pressable" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: '#a9b2c1', textDecoration: 'none' }}>
              Upload
            </Link>
            <Link href="/api" className="navItem pressable" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: '#a9b2c1', textDecoration: 'none' }}>
              API keys
            </Link>
            <Link href="/docs" className="navItem pressable" style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', fontSize: '0.82rem', color: '#a9b2c1', textDecoration: 'none' }}>
              Docs
            </Link>
          </nav>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a92a1' }}>
                Folders
              </div>
              <button
                onClick={() => setCreatingFolder((v) => !v)}
                className="pressable"
                title="New folder"
                style={{ width: '18px', height: '18px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#cfd6e1', fontSize: '0.75rem', lineHeight: 1, cursor: 'pointer' }}
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
                  style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#eef1f6', fontSize: '0.75rem', outline: 'none' }}
                />
                <button onClick={createFolder} className="pressable" style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: 'none', background: 'rgba(233,236,242,0.18)', color: '#eef1f6', fontSize: '0.72rem', cursor: 'pointer' }}>
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
                  background: selectedFolderId === null ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: selectedFolderId === null ? '#eef1f6' : '#a9b2c1', fontSize: '0.78rem',
                }}
              >
                <span>All files</span>
                <span style={{ color: '#8a92a1' }}>{uploads.length}</span>
              </button>
              <button
                onClick={() => setSelectedFolderId(UNFILED)}
                className="folderItem pressable"
                style={{
                  display: 'flex', justifyContent: 'space-between', textAlign: 'left', padding: '0.4rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: selectedFolderId === UNFILED ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: selectedFolderId === UNFILED ? '#eef1f6' : '#a9b2c1', fontSize: '0.78rem',
                }}
              >
                <span>Unfiled</span>
                <span style={{ color: '#8a92a1' }}>{unfiledCount}</span>
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className="folderItem pressable"
                  style={{
                    display: 'flex', justifyContent: 'space-between', textAlign: 'left', padding: '0.4rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    background: selectedFolderId === folder.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: selectedFolderId === folder.id ? '#eef1f6' : '#a9b2c1', fontSize: '0.78rem',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                  <span style={{ color: '#8a92a1', flexShrink: 0, marginLeft: '0.4rem' }}>{folderCounts.get(folder.id)?.count || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.8rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#a9b2c1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.4rem' }}>
              {userEmail}
            </div>
            <button
              onClick={logout}
              className="pressable"
              style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#a9b2c1', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left' }}
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
          border: isDragOver ? '2px dashed rgba(79,248,192,0.5)' : '2px dashed transparent',
          borderRadius: isDragOver ? '18px' : 0,
          margin: isDragOver ? '0.5rem' : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.6rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 3.4vw, 1.9rem)' }}>Welcome back</h1>
              <p style={{ margin: '0.3rem 0 0', color: '#a9b2c1', fontSize: '0.85rem' }}>{userEmail}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files"
                style={{ padding: '0.55rem 0.85rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#eef1f6', fontSize: '0.78rem', outline: 'none', width: '200px' }}
              />
              <div style={{ padding: '0.4rem 0.75rem', borderRadius: '999px', ...glass, color: syncing ? '#7ef4cb' : '#a9b2c1', fontSize: '0.7rem' }}>
                {syncedLabel}
              </div>
            </div>
          </div>

          {/* Action cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem', marginBottom: '1.8rem' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: '#eef1f6' }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>+ Upload files</div>
              <div style={{ fontSize: '0.68rem', color: '#8a92a1', marginTop: '0.2rem' }}>
                {uploadingCount > 0 ? `Uploading ${uploadingCount}…` : 'or drop anywhere'}
              </div>
            </button>
            <button
              onClick={() => setCreatingFolder(true)}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: '#eef1f6' }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>+ New folder</div>
              <div style={{ fontSize: '0.68rem', color: '#8a92a1', marginTop: '0.2rem' }}>Organize your files</div>
            </button>
            <button
              onClick={copyAllLinks}
              disabled={uploads.length === 0}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: uploads.length === 0 ? 'default' : 'pointer', color: '#eef1f6', opacity: uploads.length === 0 ? 0.5 : 1 }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{copiedAll ? 'Copied!' : 'Copy all links'}</div>
              <div style={{ fontSize: '0.68rem', color: '#8a92a1', marginTop: '0.2rem' }}>{uploads.length} file{uploads.length === 1 ? '' : 's'}</div>
            </button>
            <button
              onClick={() => syncAll(false)}
              disabled={syncing}
              className="actionCard pressable"
              style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: syncing ? 'default' : 'pointer', color: '#eef1f6' }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{syncing ? 'Refreshing…' : 'Refresh'}</div>
              <div style={{ fontSize: '0.68rem', color: '#8a92a1', marginTop: '0.2rem' }}>{formatFileSize(totalBytes)} stored</div>
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
                        borderColor: isSelected ? 'rgba(79,248,192,0.4)' : 'rgba(255,255,255,0.1)',
                        background: isSelected ? 'rgba(79,248,192,0.08)' : 'rgba(255,255,255,0.05)',
                        borderRadius: '14px', padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer', color: '#eef1f6',
                      }}
                    >
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {folder.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#8a92a1', marginTop: '0.3rem' }}>
                        {stats.count} file{stats.count === 1 ? '' : 's'} · {formatFileSize(stats.size)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* File list */}
          <div style={{ ...glass, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderRadius: '18px', padding: '1.3rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {selectedFolderId === UNFILED ? 'Unfiled' : selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name || 'Folder' : 'All files'}
                {selectedFolderId === UNFILED && unfiledSize > 0 && (
                  <span style={{ fontWeight: 400, color: '#8a92a1', marginLeft: '0.5rem' }}>· {formatFileSize(unfiledSize)}</span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#8a92a1' }}>{visibleUploads.length} visible</div>
            </div>

            {loading ? (
              <div style={{ color: '#8a92a1', fontSize: '0.85rem' }}>Loading uploads…</div>
            ) : error ? (
              <div style={{ color: '#e29b9b', fontSize: '0.85rem' }}>{error}</div>
            ) : visibleUploads.length === 0 ? (
              <div style={{ padding: '1.2rem', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.14)', color: '#a9b2c1', textAlign: 'center', fontSize: '0.82rem' }}>
                {uploads.length === 0
                  ? 'No uploads yet. Drop a file anywhere on this page, or use "Upload files" above.'
                  : 'No files match this view.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {visibleUploads.map((file, index) => (
                  <div
                    key={`${file.url}-${index}`}
                    style={{
                      padding: '0.75rem 0.9rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, wordBreak: 'break-all' }}>{file.filename}</div>
                      <div style={{ fontSize: '0.68rem', color: '#8a92a1', marginTop: '0.25rem' }}>
                        {formatFileSize(file.size)} · {formatTimestamp(file.timestamp)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={file.folder || ''}
                        disabled={movingUrl === file.url}
                        onChange={(e) => assignFolder(file.url, e.target.value || null)}
                        style={{ padding: '0.32rem 0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.06)', color: '#cfd6e1', fontSize: '0.68rem', outline: 'none' }}
                      >
                        <option value="">No folder</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <a href={file.url} target="_blank" rel="noreferrer" className="pressable" style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.08)', color: '#dbe0e8', textDecoration: 'none', fontSize: '0.68rem' }}>
                        Open
                      </a>
                      <button onClick={() => navigator.clipboard.writeText(file.url)} className="pressable" style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(233,236,242,0.4)', background: 'rgba(233,236,242,0.16)', color: '#eef1f6', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                        Copy
                      </button>
                      <button
                        onClick={() => deleteUpload(file.url, file.filename)}
                        disabled={deletingUrl === file.url}
                        className="pressable"
                        style={{
                          padding: '0.35rem 0.7rem', borderRadius: '999px',
                          border: deletingUrl === file.url ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(220,80,80,0.35)',
                          background: deletingUrl === file.url ? 'rgba(255,255,255,0.05)' : 'rgba(180,50,50,0.16)',
                          color: deletingUrl === file.url ? '#8a92a1' : '#f2c6c6', fontSize: '0.68rem', fontWeight: 700,
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
