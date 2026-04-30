'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  lastAccessTime: number;
  expiresAt: number;
  size: number;
}

export default function PremiumDashboard() {
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        if (mounted) {
          setLoading(true);
          setError(null);
        }

        const meResponse = await fetch('/api/premium/me', { cache: 'no-store' });
        const me = await meResponse.json();
        if (!me?.premium) {
          window.location.href = '/premium';
          return;
        }

        const uploadsResponse = await fetch('/api/premium/uploads', { cache: 'no-store' });
        if (!uploadsResponse.ok) {
          throw new Error('Failed to load uploads');
        }

        const data = await uploadsResponse.json();
        if (mounted) {
          setUploads(data.uploads || []);
          setLastSynced(Date.now());
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load uploads');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    const interval = window.setInterval(load, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
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
    setLoading(true);
    setError(null);
    try {
      const uploadsResponse = await fetch('/api/premium/uploads', { cache: 'no-store' });
      if (!uploadsResponse.ok) {
        throw new Error('Failed to load uploads');
      }
      const data = await uploadsResponse.json();
      setUploads(data.uploads || []);
      setLastSynced(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  };

  const deleteUpload = async (url: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
      setDeletingUrl(url);
      const response = await fetch('/api/premium/uploads', {
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '2rem'
        }}>
          <div>
            <div style={{
              fontSize: '0.7rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#8a92a1'
            }}>
              Premium
            </div>
            <h1 style={{
              fontSize: '2rem',
              marginTop: '0.35rem'
            }}>
              Your uploads
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
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
                color: '#c3cad6',
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
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: '#c3cad6',
                fontSize: '0.75rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              {loading ? 'Syncing…' : 'Sync now'}
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
            <div style={{ color: '#8a92a1' }}>No uploads yet. Upload a file to see it here.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {filteredUploads.map((file, index) => (
                <div
                  key={`${file.url}-${index}`}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      wordBreak: 'break-all'
                    }}>
                      {file.filename}
                    </div>
                    <div style={{
                      fontSize: '0.72rem',
                      color: '#8a92a1',
                      marginTop: '0.25rem'
                    }}>
                      Uploaded {formatTimestamp(file.timestamp)} • {formatFileSize(file.size)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="pressable"
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.13)',
                      background: 'rgba(255,255,255,0.07)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: '#c3cad6',
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
                      background: 'rgba(233,236,242,0.18)',
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
                      background: deletingUrl === file.url ? 'rgba(255,255,255,0.05)' : 'rgba(180,50,50,0.18)',
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
