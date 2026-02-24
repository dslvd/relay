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

  useEffect(() => {
    const load = async () => {
      try {
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
        setUploads(data.uploads || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load uploads');
      } finally {
        setLoading(false);
      }
    };

    load();
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
        background: '#0a0a0a',
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
                border: '1px solid #2f3541',
                color: '#c3cad6',
                textDecoration: 'none',
                fontSize: '0.75rem'
              }}
            >
              Back to upload
            </Link>
            <button
              onClick={copyAllLinks}
              className="pressable"
              disabled={uploads.length === 0 || loading}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                border: '1px solid #e9ecf2',
                background: uploads.length === 0 || loading ? '#2a2f3a' : '#e9ecf2',
                color: uploads.length === 0 || loading ? '#8a92a1' : '#0b0c10',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              {copiedAll ? 'Copied' : 'Copy all links'}
            </button>
          </div>
        </div>

        <div style={{
          background: '#111318',
          border: '1px solid #1f232b',
          borderRadius: '18px',
          padding: '1.5rem'
        }}>
          {loading ? (
            <div style={{ color: '#8a92a1' }}>Loading uploads...</div>
          ) : error ? (
            <div style={{ color: '#e29b9b' }}>{error}</div>
          ) : uploads.length === 0 ? (
            <div style={{ color: '#8a92a1' }}>No uploads yet. Upload a file to see it here.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {uploads.map((file, index) => (
                <div
                  key={`${file.url}-${index}`}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '14px',
                    border: '1px solid #22262f',
                    background: '#14161b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap'
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
                        border: '1px solid #2f3541',
                        color: '#c3cad6',
                        textDecoration: 'none',
                        fontSize: '0.7rem'
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
                        border: '1px solid #e9ecf2',
                        background: '#e9ecf2',
                        color: '#0b0c10',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer'
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
                        border: '1px solid #3a2a2a',
                        background: deletingUrl === file.url ? '#2a2f3a' : '#221717',
                        color: deletingUrl === file.url ? '#8a92a1' : '#f2c6c6',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: deletingUrl === file.url ? 'default' : 'pointer'
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
