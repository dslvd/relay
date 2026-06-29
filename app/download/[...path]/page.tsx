'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import AdBanner from '../../components/AdBanner';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp?: number;
  lastAccessTime?: number;
  expiresAt?: number;
  size?: number;
}

export default function DownloadPage() {
  const params = useParams();
  const pathArray = Array.isArray(params.path) ? params.path : [params.path];
  const pathKey = pathArray.join('/');
  const filename = pathArray[pathArray.length - 1] ?? '';
  
  const [fileData, setFileData] = useState<UploadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string>('');
  const [previewTextTruncated, setPreviewTextTruncated] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEmbedCopied, setIsEmbedCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showCdn, setShowCdn] = useState(false);
  const [isCdnCopied, setIsCdnCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);

  const downloadUrl = `/d/${pathKey}`;
  const downloadPageUrl = `/download/${pathKey}`;
  const shortLink = typeof window !== 'undefined'
    ? `${window.location.origin}${downloadPageUrl}`
    : downloadPageUrl;

  const cdnUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/p/${pathKey}`
    : `/p/${pathKey}`;

  const isPreviewable = (fname: string): boolean => {
    const ext = fname.split('.').pop()?.toLowerCase() || '';
    const previewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'pdf', 'txt', 'json', 'md'];
    return previewableTypes.includes(ext);
  };

  const getFileType = (fname: string): string => {
    const ext = fname.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
    if (ext === 'pdf') return 'pdf';
    if (['txt', 'json', 'md'].includes(ext)) return 'text';
    return 'unknown';
  };

  const embedSnippet = useMemo((): string | null => {
    const directAbs = typeof window !== 'undefined'
      ? `${window.location.origin}${downloadUrl}`
      : downloadUrl;
    const type = getFileType(fileData?.filename || filename);
    if (type === 'image') {
      return `<a href="${shortLink}" target="_blank" rel="noreferrer"><img src="${directAbs}" alt="${(fileData?.filename || filename).replace(/"/g, '')}" style="max-width:100%;height:auto" /></a>`;
    }
    if (type === 'video') {
      return `<video controls src="${directAbs}" style="max-width:100%"></video>`;
    }
    if (type === 'pdf') {
      return `<a href="${shortLink}" target="_blank" rel="noreferrer">Open PDF</a>`;
    }
    return null;
  }, [shortLink, downloadUrl, fileData, filename]);

  const copyShortLink = async () => {
    await navigator.clipboard.writeText(shortLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const ensureQr = async (): Promise<string | null> => {
    if (qrDataUrl) return qrDataUrl;
    const url = `${window.location.origin}${downloadUrl}`;
    try {
      const mod = await import('qrcode');
      const dataUrl = await mod.toDataURL(url, {
        margin: 1,
        width: 240,
        color: { dark: '#f5f5f5', light: '#00000000' },
      });
      setQrDataUrl(dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetch('/api/premium/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        setIsPremium(Boolean(data.premium));
      })
      .catch(() => {
        setIsPremium(false);
      });
  }, []);

  useEffect(() => {
    if (!showPreview) return;
    if (!fileData) return;
    if (getFileType(fileData.filename) !== 'text') return;

    let cancelled = false;
    (async () => {
      try {
        setPreviewLoading(true);
        setPreviewText('');
        setPreviewTextTruncated(false);

        const res = await fetch(downloadUrl, { cache: 'no-store' });
        if (!res.ok || !res.body) {
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const MAX_BYTES = 220 * 1024; // keep preview snappy
        let received = 0;
        let text = '';

        while (received < MAX_BYTES) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          received += value.byteLength;
          text += decoder.decode(value, { stream: true });
          if (cancelled) return;
        }

        if (received >= MAX_BYTES) {
          setPreviewTextTruncated(true);
          try {
            reader.cancel();
          } catch {
            // ignore
          }
        }

        // Pretty-print JSON when possible.
        const ext = (fileData.filename.split('.').pop() || '').toLowerCase();
        if (ext === 'json') {
          try {
            const obj = JSON.parse(text);
            text = JSON.stringify(obj, null, 2);
          } catch {
            // ignore
          }
        }

        setPreviewText(text);
      } finally {
        setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showPreview, fileData, downloadUrl]);

  useEffect(() => {
    const fetchFileData = async () => {
      try {
        // Track page view
        fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pageview', path: `/download/${pathKey}` })
        }).catch(() => {}); // Silently fail
        
        const [fileInfoResponse, analyticsResponse] = await Promise.all([
          fetch(`/api/file-info?key=${encodeURIComponent(pathKey)}`, { cache: 'no-store' }),
          fetch(`/api/analytics?key=${encodeURIComponent(pathKey)}&filename=${encodeURIComponent(filename)}`, { cache: 'no-store' })
        ]);

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setDownloadCount(Number(analyticsData?.totalDownloads) || 0);
        }

        if (fileInfoResponse.ok) {
          const data = await fileInfoResponse.json();
          const record = data?.data?.record as UploadRecord | undefined;
          if (record) {
            setFileData(record);
            setNotFound(false);

            // Update last access time when viewing the download page
            fetch('/api/access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename })
            }).catch(err => console.error('Failed to update access time:', err));
            return;
          }
        }

        const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
        if (headResponse.ok) {
          const sizeHeader = headResponse.headers.get('Content-Length');
          const size = sizeHeader ? Number(sizeHeader) : undefined;
          setFileData({ url: downloadUrl, filename, size, timestamp: undefined });
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error('Failed to fetch file data:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchFileData();
  }, [pathKey, filename, downloadUrl]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetch(`/api/analytics?key=${encodeURIComponent(pathKey)}&filename=${encodeURIComponent(filename)}`, { cache: 'no-store' })
          .then(res => res.json())
          .then(data => setDownloadCount(Number(data?.totalDownloads) || 0))
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pathKey, filename]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getExpiresIn = (): string => {
    const retentionMs = 15 * 24 * 60 * 60 * 1000;
    const expiresTime =
      fileData?.expiresAt ??
      (typeof fileData?.lastAccessTime === 'number'
        ? fileData.lastAccessTime + retentionMs
        : typeof fileData?.timestamp === 'number'
          ? fileData.timestamp + retentionMs
          : undefined);

    if (!expiresTime) return 'Unknown';

    const now = Date.now();
    const diffMs = expiresTime - now;

    if (diffMs <= 0) return 'Expired';

    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) return `In ${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `In ${hours} hour${hours !== 1 ? 's' : ''}`;
    return 'Less than 1 hour';
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 0
      }}
    >
      {/* Back to Home - Fixed Top Left */}
      <a
        href="/"
        style={{
          position: 'fixed',
          top: '1.5rem',
          left: '1.5rem',
          zIndex: 50,
          textDecoration: 'none',
          color: 'var(--c-text)',
          fontFamily: "'Open Sans', sans-serif",
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          transition: 'background 0.2s ease',
          padding: '0.5rem 0.8rem',
          borderRadius: '6px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(128,128,128,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        ← Back
      </a>

      <style>{`
        @keyframes previewSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 4vw'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--c-dim)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              Loading...
            </div>
          </div>
        ) : notFound || !fileData ? (
          <section
            style={{
              width: 'min(500px, 92vw)',
              borderRadius: '20px',
              border: '1px solid rgba(128,128,128,0.18)',
              background: 'rgba(128,128,128,0.05)',
              padding: '1.5rem',
              boxShadow: '0 22px 60px rgba(0, 0, 0, 0.25)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--c-dim)',
                marginBottom: '0.6rem'
              }}
            >
              404
            </div>
            <h1
              style={{
                margin: '0 0 0.4rem',
                fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
                letterSpacing: '-0.02em',
                color: 'var(--c-text)'
              }}
            >
              File not found
            </h1>
            <p
              style={{
                margin: 0,
                color: 'var(--c-dim)',
                fontSize: '0.85rem',
                marginBottom: '1.2rem'
              }}
            >
              The file you're looking for doesn't exist, has expired, or may have been deleted.
            </p>
              <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                background: 'rgba(128,128,128,0.14)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(128,128,128,0.25)',
                color: 'var(--c-text)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
              }}
            >
              Upload a new file
            </a>
          </section>
        ) : (
          <section
            style={{
              width: 'min(500px, 92vw)',
              borderRadius: '20px',
              border: '1px solid rgba(128,128,128,0.18)',
              background: 'rgba(128,128,128,0.05)',
              padding: '1.5rem',
              boxShadow: '0 22px 60px rgba(0, 0, 0, 0.25)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto'
            }}
          >
            {showPreview ? (
              <>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(128,128,128,0.22)',
                    background: 'rgba(128,128,128,0.07)',
                    color: 'var(--c-text)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginBottom: '1rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2
                  }}
                >
                  ← Back to details
                </button>

                {/* Preview Content */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '400px',
                    position: 'relative'
                  }}
                >
                  {previewLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.6rem',
                        background: 'rgba(128,128,128,0.15)',
                        borderRadius: '12px'
                      }}
                    >
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '999px',
                          border: '2px solid rgba(128,128,128,0.45)',
                          borderTopColor: 'transparent',
                          animation: 'previewSpin 0.8s linear infinite'
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>
                        Loading preview...
                      </span>
                    </div>
                  )}
                  {getFileType(fileData.filename) === 'image' && (
                    <img
                      src={downloadUrl}
                      alt="Preview"
                      style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => setPreviewLoading(false)}
                    />
                  )}
                  {getFileType(fileData.filename) === 'video' && (
                    <video
                      controls
                      style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }}
                      onLoadedData={() => setPreviewLoading(false)}
                      onError={() => setPreviewLoading(false)}
                    >
                      <source src={downloadUrl} />
                      Your browser does not support the video tag.
                    </video>
                  )}
                  {getFileType(fileData.filename) === 'pdf' && (
                    <iframe
                      src={downloadUrl}
                      style={{ width: '100%', height: '100%', borderRadius: '12px', border: 'none' }}
                      onLoad={() => setPreviewLoading(false)}
                    />
                  )}
                  {getFileType(fileData.filename) === 'text' && (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '12px',
                        border: '1px solid rgba(128,128,128,0.14)',
                        background: 'rgba(128,128,128,0.06)',
                        overflow: 'auto',
                        padding: '0.8rem',
                      }}
                    >
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '0.78rem',
                          lineHeight: 1.45,
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          color: 'var(--c-text)',
                        }}
                      >
                        {previewText || (previewLoading ? 'Loading…' : 'No preview')}
                      </pre>
                      {previewTextTruncated && (
                        <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--c-dim)' }}>
                          Preview truncated.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Title Section */}
                <div style={{ marginBottom: '0.8rem' }}>
                  <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--c-text)' }}>
                    Download your file
                  </h1>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--c-dim)' }}>
                    Secure data routing via Relay.
                  </p>
                </div>

                {/* File Details Table */}
                <div style={{ marginBottom: '1.2rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: '80px', color: 'var(--c-dim)' }}>Name:</div>
                    <div style={{ flex: 1, color: 'var(--c-text)', wordBreak: 'break-all' }}>
                      {fileData.filename}
                    </div>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: '80px', color: 'var(--c-dim)' }}>Size:</div>
                    <div style={{ flex: 1, color: 'var(--c-text)' }}>
                      {typeof fileData.size === 'number' ? formatFileSize(fileData.size) : 'Unknown'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: '80px', color: 'var(--c-dim)' }}>Uploaded:</div>
                    <div style={{ flex: 1, color: 'var(--c-text)' }}>
                      {fileData.timestamp
                        ? new Date(fileData.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'Unknown'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: '80px', color: 'var(--c-dim)' }}>Downloads:</div>
                    <div style={{ flex: 1, color: 'var(--c-text)' }}>
                      {typeof downloadCount === 'number' ? downloadCount.toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: '80px', color: 'var(--c-dim)' }}>Expires:</div>
                    <div style={{ flex: 1, color: 'var(--c-text)' }}>
                      {getExpiresIn()}
                    </div>
                  </div>
                </div>

                {/* ── Primary action ── */}
                <a
                  href={downloadUrl}
                  download
                  onClick={(e) => {
                    e.preventDefault();
                    const link = document.createElement('a');
                    link.href = `${downloadUrl}?dl=${Date.now()}`;
                    link.setAttribute('download', fileData.filename || 'download');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    // Explicitly POST the download event so the count is tracked
                    // reliably regardless of whether the /d/[...] proxy route
                    // manages to record it (e.g. slow R2 response, cold start).
                    fetch('/api/analytics', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'download',
                        filename: fileData.filename || filename,
                        fileKey: pathKey,
                        bytes: fileData.size,
                      }),
                    })
                      .then(() =>
                        fetch(`/api/analytics?key=${encodeURIComponent(pathKey)}&filename=${encodeURIComponent(filename)}`, { cache: 'no-store' })
                      )
                      .then(res => res.json())
                      .then(data => setDownloadCount(Number(data?.totalDownloads) || 0))
                      .catch(() => {});
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    width: '100%',
                    padding: '0.72rem 1rem',
                    borderRadius: '10px',
                    background: 'rgba(126,244,203,0.14)',
                    border: '1px solid rgba(126,244,203,0.32)',
                    color: '#7ef4cb',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    letterSpacing: '0.01em',
                    cursor: 'pointer',
                    transition: 'background 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease',
                    boxShadow: '0 0 0 0 rgba(126,244,203,0)',
                    marginBottom: '0.6rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(126,244,203,0.22)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 18px rgba(126,244,203,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(126,244,203,0.14)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 0 0 rgba(126,244,203,0)';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </a>

                {/* ── Secondary row ── */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    onClick={copyShortLink}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.38rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: isCopied ? 'rgba(79,248,192,0.12)' : 'rgba(128,128,128,0.07)',
                      border: `1px solid ${isCopied ? 'rgba(79,248,192,0.35)' : 'rgba(128,128,128,0.18)'}`,
                      color: isCopied ? '#4ff8c0' : 'var(--c-text)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCopied) e.currentTarget.style.background = 'rgba(128,128,128,0.13)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCopied) e.currentTarget.style.background = 'rgba(128,128,128,0.07)';
                    }}
                  >
                    {isCopied ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        Copy link
                      </>
                    )}
                  </button>

                  {isPreviewable(fileData.filename) && (
                    <button
                      onClick={() => { setPreviewLoading(true); setShowPreview(true); }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.38rem',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(128,128,128,0.07)',
                        border: '1px solid rgba(128,128,128,0.18)',
                        color: 'var(--c-text)',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(128,128,128,0.13)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(128,128,128,0.07)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Preview
                    </button>
                  )}
                </div>

                {/* ── Tertiary icon strip ── */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.15rem' }}>
                  <button
                    onClick={async () => { const qr = await ensureQr(); if (!qr) return; setIsQrOpen((v) => !v); }}
                    title="QR code"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.38rem',
                      padding: '0.5rem 0.7rem',
                      borderRadius: '8px',
                      background: isQrOpen ? 'rgba(128,128,128,0.13)' : 'rgba(128,128,128,0.05)',
                      border: `1px solid ${isQrOpen ? 'rgba(128,128,128,0.28)' : 'rgba(128,128,128,0.14)'}`,
                      color: 'var(--c-dim)',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(128,128,128,0.11)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isQrOpen ? 'rgba(128,128,128,0.13)' : 'rgba(128,128,128,0.05)'; e.currentTarget.style.color = 'var(--c-dim)'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="4" height="4"/></svg>
                    QR code
                  </button>

                  {embedSnippet && (
                    <button
                      onClick={() => setShowEmbed((prev) => !prev)}
                      title="Embed snippet"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.38rem',
                        padding: '0.5rem 0.7rem',
                        borderRadius: '8px',
                        background: showEmbed ? 'rgba(128,128,128,0.13)' : 'rgba(128,128,128,0.05)',
                        border: `1px solid ${showEmbed ? 'rgba(128,128,128,0.28)' : 'rgba(128,128,128,0.14)'}`,
                        color: 'var(--c-dim)',
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(128,128,128,0.11)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = showEmbed ? 'rgba(128,128,128,0.13)' : 'rgba(128,128,128,0.05)'; e.currentTarget.style.color = 'var(--c-dim)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      Embed
                    </button>
                  )}

                  <button
                    onClick={() => setShowCdn((prev) => !prev)}
                    title="CDN link — direct URL for use as src"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.38rem',
                      padding: '0.5rem 0.7rem',
                      borderRadius: '8px',
                      background: showCdn ? 'rgba(128,128,128,0.13)' : 'rgba(128,128,128,0.05)',
                      border: `1px solid ${showCdn ? 'rgba(128,128,128,0.28)' : 'rgba(128,128,128,0.14)'}`,
                      color: 'var(--c-dim)',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(128,128,128,0.11)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = showCdn ? 'rgba(128,128,128,0.13)' : 'rgba(128,128,128,0.05)'; e.currentTarget.style.color = 'var(--c-dim)'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    CDN link
                  </button>
                </div>

                {/* ── Expanded panels ── */}
                {isQrOpen && qrDataUrl && (
                  <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      padding: '0.85rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(128,128,128,0.16)',
                      background: 'rgba(128,128,128,0.06)',
                    }}>
                      <img src={qrDataUrl} alt="QR code" style={{ width: '200px', height: '200px', display: 'block' }} />
                    </div>
                  </div>
                )}

                {showCdn && (
                  <div style={{ marginTop: '0.65rem' }}>
                    <div style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(128,128,128,0.13)',
                      background: 'rgba(128,128,128,0.05)',
                      fontSize: '0.68rem',
                      color: 'var(--c-dim)',
                      marginBottom: '0.45rem',
                      lineHeight: 1.4,
                    }}>
                      Direct URL — use as <code style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--c-text)' }}>src</code> in <code style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--c-text)' }}>&lt;img&gt;</code>, <code style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--c-text)' }}>&lt;video&gt;</code>, CSS, or any app
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(cdnUrl);
                        setIsCdnCopied(true);
                        setTimeout(() => setIsCdnCopied(false), 2000);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.52rem 0.9rem',
                        borderRadius: '8px',
                        background: isCdnCopied ? 'rgba(79,248,192,0.12)' : 'rgba(128,128,128,0.07)',
                        border: `1px solid ${isCdnCopied ? 'rgba(79,248,192,0.35)' : 'rgba(128,128,128,0.16)'}`,
                        color: isCdnCopied ? '#4ff8c0' : 'var(--c-text)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        marginBottom: '0.45rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.38rem',
                      }}
                    >
                      {isCdnCopied ? (
                        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                      ) : (
                        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copy CDN link</>
                      )}
                    </button>
                    <div style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(128,128,128,0.13)',
                      background: 'rgba(128,128,128,0.05)',
                      fontSize: '0.7rem',
                      color: 'var(--c-dim)',
                      lineHeight: 1.45,
                      wordBreak: 'break-all',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}>
                      {cdnUrl}
                    </div>
                  </div>
                )}

                {showEmbed && embedSnippet && (
                  <div style={{ marginTop: '0.65rem' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(embedSnippet);
                        setIsEmbedCopied(true);
                        setTimeout(() => setIsEmbedCopied(false), 2000);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.52rem 0.9rem',
                        borderRadius: '8px',
                        background: isEmbedCopied ? 'rgba(79,248,192,0.12)' : 'rgba(128,128,128,0.07)',
                        border: `1px solid ${isEmbedCopied ? 'rgba(79,248,192,0.35)' : 'rgba(128,128,128,0.16)'}`,
                        color: isEmbedCopied ? '#4ff8c0' : 'var(--c-text)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        marginBottom: '0.45rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.38rem',
                      }}
                    >
                      {isEmbedCopied ? (
                        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                      ) : (
                        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy embed snippet</>
                      )}
                    </button>
                    <div style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(128,128,128,0.13)',
                      background: 'rgba(128,128,128,0.05)',
                      fontSize: '0.7rem',
                      color: 'var(--c-dim)',
                      lineHeight: 1.45,
                      wordBreak: 'break-all',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}>
                      {embedSnippet}
                    </div>
                  </div>
                )}

                {/* Ad Banner */}
                {!isPremium && (
                  <AdBanner 
                    dataAdSlot="9876543210" 
                    style={{ marginTop: '1rem' }}
                  />
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
