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
}

export default function PlusDashboard() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const mountedRef = useRef(false);
  const syncRequestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    const syncUploads = async (initial = false) => {
      const requestId = ++syncRequestIdRef.current;
      try {
        if (mountedRef.current) {
          if (initial) {
            setLoading(true);
          } else {
            setSyncing(true);
          }
          setError(null);
        }

        const meResponse = await fetch('/api/plus/me', { cache: 'no-store' });
        if (!mountedRef.current || requestId !== syncRequestIdRef.current) return;
        const me = await meResponse.json();
        if (!me?.plus) {
          window.location.href = '/plus';
          return;
        }

        const uploadsResponse = await fetch('/api/plus/uploads', { cache: 'no-store' });
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
          if (initial) {
            setLoading(false);
          } else {
            setSyncing(false);
          }
        }
      }
    };

    void syncUploads(true);
    const interval = window.setInterval(() => {
      void syncUploads(false);
    }, 30000);

    const handleFocus = () => {
      void syncUploads(false);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      syncRequestIdRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
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

  const copyAllLinks = async () => {
    if (uploads.length === 0) return;
    const links = uploads.map((file) => file.url).join('\n');
    await navigator.clipboard.writeText(links);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1200);
  };

  const refreshUploads = async () => {
    if (syncing) return;
    const requestId = ++syncRequestIdRef.current;
    try {
      if (mountedRef.current) {
        setSyncing(true);
        setError(null);
      }

      const meResponse = await fetch('/api/plus/me', { cache: 'no-store' });
      if (!mountedRef.current || requestId !== syncRequestIdRef.current) return;
      const me = await meResponse.json();
      if (!me?.plus) {
        window.location.href = '/plus';
        return;
      }

      const uploadsResponse = await fetch('/api/plus/uploads', { cache: 'no-store' });
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
        setSyncing(false);
      }
    }
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

      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }

      setUploads((current) => current.filter((item) => item.url !== url));
    } catch {
      alert('Failed to delete upload');
    } finally {
      setDeletingUrl(null);
    }
  };

  const filteredUploads = uploads.filter((file) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return file.filename.toLowerCase().includes(q) || file.url.toLowerCase().includes(q);
  });

  const totalBytes = uploads.reduce((sum, file) => sum + (file.size || 0), 0);
  const latestUpload = uploads[0];
  const queuedCount = uploads.length;
  const syncedLabel = loading
    ? 'Loading uploads'
    : syncing
      ? 'Refreshing list'
      : lastSynced
        ? `Synced at ${new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'Not synced yet';

  return (
    <>
      <style jsx>{`
        .pressable {
          transition: transform 0.14s ease, opacity 0.14s ease;
          will-change: transform;
        }

        .pressable:active {
          transform: scale(0.96);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
        backgroundAttachment: 'fixed',
        color: '#eef1f6',
        fontFamily: "'Sora', sans-serif",
        padding: '3.5rem 6vw'
      }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <div style={{
          marginBottom: '1.5rem',
          padding: '1.25rem 1.3rem',
          borderRadius: '22px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
          boxShadow: '0 16px 42px rgba(0,0,0,0.28)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '0.68rem',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: '#8a92a1'
              }}>
                Relay Plus vault
              </div>
              <h1 style={{
                margin: '0.35rem 0 0',
                fontSize: 'clamp(1.7rem, 4vw, 2.35rem)',
                lineHeight: 1.05
              }}>
                Your uploads
              </h1>
              <p style={{
                margin: '0.45rem 0 0',
                color: '#a9b2c1',
                fontSize: '0.9rem',
                maxWidth: '52ch'
              }}>
                Browse, sync, and manage the files attached to your Relay plus account.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link
                href="/"
                className="pressable"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.13)',
                  background: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#cfd6e1',
                  textDecoration: 'none',
                  fontSize: '0.75rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                Back to upload
              </Link>
              <button
                onClick={refreshUploads}
                className="pressable"
                disabled={loading || syncing}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.13)',
                  background: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#cfd6e1',
                  fontSize: '0.75rem',
                  cursor: loading || syncing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                {loading || syncing ? 'Refreshing…' : 'Refresh list'}
              </button>
              <button
                onClick={copyAllLinks}
                className="pressable"
                disabled={uploads.length === 0 || loading}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '999px',
                  border: uploads.length === 0 || loading ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(233,236,242,0.4)',
                  background: uploads.length === 0 || loading ? 'rgba(255,255,255,0.05)' : 'rgba(233,236,242,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: uploads.length === 0 || loading ? '#8a92a1' : '#eef1f6',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: uploads.length === 0 || loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                {copiedAll ? 'Copied' : 'Copy all links'}
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '0.6rem',
            flexWrap: 'wrap',
            marginTop: '1rem'
          }}>
            <div style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#cfd6e1',
              fontSize: '0.74rem'
            }}>
              {queuedCount} file{queuedCount === 1 ? '' : 's'}
            </div>
            <div style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#cfd6e1',
              fontSize: '0.74rem'
            }}>
              {formatFileSize(totalBytes)} stored
            </div>
            <div style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: syncing ? 'rgba(79, 248, 192, 0.14)' : 'rgba(255,255,255,0.05)',
              color: syncing ? '#7ef4cb' : '#cfd6e1',
              fontSize: '0.74rem'
            }}>
              {syncedLabel}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.9rem',
          marginBottom: '1.6rem'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            padding: '1.2rem'
          }}>
            <div style={{ fontSize: '0.72rem', color: '#8a92a1', marginBottom: '0.35rem' }}>Total uploads</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{uploads.length}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            padding: '1.2rem'
          }}>
            <div style={{ fontSize: '0.72rem', color: '#8a92a1', marginBottom: '0.35rem' }}>Storage used</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatFileSize(totalBytes)}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            padding: '1.2rem'
          }}>
            <div style={{ fontSize: '0.72rem', color: '#8a92a1', marginBottom: '0.35rem' }}>Latest upload</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, wordBreak: 'break-all' }}>
              {latestUpload ? latestUpload.filename : '—'}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            padding: '1.2rem'
          }}>
            <div style={{ fontSize: '0.72rem', color: '#8a92a1', marginBottom: '0.35rem' }}>Last synced</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {lastSynced ? new Date(lastSynced).toLocaleTimeString() : '—'}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#8a92a1', marginTop: '0.25rem' }}>Auto-sync every 30s</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '18px',
          padding: '1.2rem 1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          marginBottom: '1.4rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.7rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ fontSize: '0.74rem', color: '#8a92a1', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Search
            </div>
            <div style={{ fontSize: '0.74rem', color: '#8a92a1' }}>
              {filteredUploads.length} visible
            </div>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search uploads"
            style={{
              width: '100%',
              padding: '0.7rem 0.9rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: '#eef1f6',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '18px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)'
        }}>
          {loading ? (
            <div style={{ color: '#8a92a1' }}>Loading uploads...</div>
          ) : error ? (
            <div style={{ color: '#e29b9b' }}>{error}</div>
          ) : filteredUploads.length === 0 ? (
            <div style={{
              padding: '1rem',
              borderRadius: '14px',
              border: '1px dashed rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.03)',
              color: '#a9b2c1',
              textAlign: 'center'
            }}>
              {uploads.length === 0
                ? 'No uploads yet. Plus uploads will appear here automatically once they sync.'
                : 'No matches for your search. Try a different filename or clear the filter.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {filteredUploads.map((file, index) => (
                <div
                  key={`${file.url}-${index}`}
                  style={{
                    padding: '1rem 1.05rem',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)'
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                    <div style={{
                      fontSize: '0.98rem',
                      fontWeight: 600,
                      wordBreak: 'break-all'
                    }}>
                      {file.filename}
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                      <span style={{
                        padding: '0.28rem 0.55rem',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#cfd6e1',
                        fontSize: '0.68rem'
                      }}>
                        {formatFileSize(file.size)}
                      </span>
                      <span style={{
                        padding: '0.28rem 0.55rem',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#cfd6e1',
                        fontSize: '0.68rem'
                      }}>
                        Uploaded {formatTimestamp(file.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="pressable"
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.13)',
                      background: 'rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: '#dbe0e8',
                      textDecoration: 'none',
                      fontSize: '0.7rem',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      Open
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(file.url)}
                      className="pressable"
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '999px',
                      border: '1px solid rgba(233,236,242,0.4)',
                      background: 'rgba(233,236,242,0.16)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: '#eef1f6',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      Copy link
                    </button>
                    <button
                      onClick={() => deleteUpload(file.url, file.filename)}
                      className="pressable"
                      disabled={deletingUrl === file.url}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '999px',
                      border: deletingUrl === file.url ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(220,80,80,0.35)',
                      background: deletingUrl === file.url ? 'rgba(255,255,255,0.05)' : 'rgba(180,50,50,0.16)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: deletingUrl === file.url ? '#8a92a1' : '#f2c6c6',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: deletingUrl === file.url ? 'default' : 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      {deletingUrl === file.url ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
