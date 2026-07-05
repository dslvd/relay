'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import LordIcon from '../../components/LordIcon';

interface SharedFile {
  url: string;
  filename: string;
  size: number;
  timestamp: number;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Extracts the /d/{key} download-page link from a stored history URL,
// regardless of whether it was saved under the current or legacy prefix.
function toDownloadPageUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const path = parsed.pathname.replace(/\/+$/, '');
    const key = path.includes('/d/')
      ? path.split('/d/')[1]
      : path.includes('/download/')
        ? path.split('/download/')[1]
        : path.split('/').filter(Boolean).pop();
    return `/d/${key || ''}`;
  } catch {
    return rawUrl;
  }
}

export default function SharedFolderPage() {
  const params = useParams();
  const code = typeof params.code === 'string' ? params.code : '';

  const [folderName, setFolderName] = useState('');
  const [files, setFiles] = useState<SharedFile[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = folderName ? `${folderName} — Shared folder` : 'Shared folder';
  }, [folderName]);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(`/api/folders/shared/${encodeURIComponent(code)}`, { cache: 'no-store' });
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const payload = await res.json();
        setFolderName(payload?.data?.folder?.name || 'Shared folder');
        setFiles(payload?.data?.files || []);
      } catch {
        setNotFound(true);
      }
    })();
  }, [code]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
      <a
        href="/"
        style={{
          position: 'fixed', top: '1.5rem', left: '1.5rem', zIndex: 50, textDecoration: 'none',
          color: 'var(--c-text)', fontFamily: "'Open Sans', sans-serif", fontSize: '0.85rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem', borderRadius: '6px',
        }}
      >
        <LordIcon name="arrowRight" size={13} mirror />
        Back
      </a>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 4vw' }}>
        {notFound ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--c-text)', marginBottom: '0.5rem' }}>
              Shared folder not found
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--c-dim)' }}>
              This link is invalid, was revoked, or the folder is empty.
            </p>
          </div>
        ) : files === null ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--c-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Loading...
          </div>
        ) : (
          <section
            style={{
              width: 'min(560px, 92vw)', borderRadius: '20px', border: '1px solid rgba(128,128,128,0.18)',
              background: 'rgba(128,128,128,0.05)', padding: '1.5rem', maxHeight: '80vh', overflow: 'auto',
              boxShadow: '0 22px 60px rgba(0,0,0,0.25)',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--c-text)' }}>{folderName}</h1>
            <p style={{ margin: '0.25rem 0 1.1rem', fontSize: '0.78rem', color: 'var(--c-dim)' }}>
              {files.length} file{files.length === 1 ? '' : 's'} shared via Relay
            </p>

            {files.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--c-dim)', padding: '1rem 0', textAlign: 'center' }}>
                This folder is empty.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {files.map((file) => (
                  <a
                    key={file.url}
                    href={toDownloadPageUrl(file.url)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.8rem',
                      borderRadius: '10px', border: '1px solid rgba(128,128,128,0.14)', background: 'rgba(128,128,128,0.05)',
                      textDecoration: 'none', color: 'var(--c-text)', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(128,128,128,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(128,128,128,0.05)'; }}
                  >
                    <LordIcon name="download" size={14} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 500 }}>
                      {file.filename}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--c-dim)', flexShrink: 0 }}>
                      {formatFileSize(file.size)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
