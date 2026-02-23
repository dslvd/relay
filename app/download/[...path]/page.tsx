'use client';

import { useEffect, useState } from 'react';
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
  const [isCopied, setIsCopied] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);

  const downloadUrl = `/d/${pathKey}`;

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

  useEffect(() => {
    const fetchFileData = async () => {
      try {
        // Track page view
        fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pageview', path: `/download/${pathKey}` })
        }).catch(() => {}); // Silently fail
        
        const [historyResponse, analyticsResponse] = await Promise.all([
          fetch('/api/history', { cache: 'no-store' }),
          fetch(`/api/analytics?filename=${encodeURIComponent(filename)}`, { cache: 'no-store' })
        ]);

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setDownloadCount(analyticsData.totalDownloads ?? 0);
        }

        if (historyResponse.ok) {
          const data = await historyResponse.json();
          const records = data.history || [];
          const file = records.find((r: UploadRecord) => r.url.includes(pathKey));
          if (file) {
            setFileData(file);

            // Update last access time when viewing the download page
            fetch('/api/access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename })
            }).catch(err => console.error('Failed to update access time:', err));
          } else {
            const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
            if (headResponse.ok) {
              const sizeHeader = headResponse.headers.get('Content-Length');
              const size = sizeHeader ? Number(sizeHeader) : undefined;
              setFileData({ url: downloadUrl, filename, size, timestamp: undefined });
              setNotFound(false);
            } else {
              setNotFound(true);
            }
          }
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        background: '#0a0a0a',
        color: '#f5f5f5',
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
          color: '#f5f5f5',
          fontFamily: "'Open Sans', sans-serif",
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          transition: 'colors 0.2s ease',
          padding: '0.5rem 0.8rem',
          borderRadius: '6px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        ← Home
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
                color: 'rgba(245, 245, 245, 0.6)',
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
              border: '1px solid rgba(255, 255, 255, 0.16)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '1.5rem',
              boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(245, 245, 245, 0.55)',
                marginBottom: '0.6rem'
              }}
            >
              404
            </div>
            <h1
              style={{
                margin: '0 0 0.4rem',
                fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
                letterSpacing: '-0.02em'
              }}
            >
              File not found
            </h1>
            <p
              style={{
                margin: 0,
                color: 'rgba(245, 245, 245, 0.7)',
                fontSize: '0.85rem',
                marginBottom: '1.2rem'
              }}
            >
              The file you're looking for doesn't exist or has expired.
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                background: '#ffffff',
                color: '#0a0a0a',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.85rem'
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
              border: '1px solid rgba(255, 255, 255, 0.16)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '1.5rem',
              boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45)',
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
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#f5f5f5',
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
                        background: 'rgba(10, 10, 10, 0.6)',
                        borderRadius: '12px'
                      }}
                    >
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '999px',
                          border: '2px solid rgba(245, 245, 245, 0.5)',
                          borderTopColor: 'transparent',
                          animation: 'previewSpin 0.8s linear infinite'
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'rgba(245, 245, 245, 0.7)' }}>
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
                    <iframe
                      src={downloadUrl}
                      style={{ width: '100%', height: '100%', borderRadius: '12px', border: 'none' }}
                      onLoad={() => setPreviewLoading(false)}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Title Section */}
                <div style={{ marginBottom: '0.8rem' }}>
                  <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                    Download your file
                  </h1>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'rgba(245, 245, 245, 0.6)' }}>
                    Secure data routing via Relay.
                  </p>
                </div>

                {/* File Details Table */}
                <div style={{ marginBottom: '1.2rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: '80px', color: 'rgba(245, 245, 245, 0.6)' }}>Name:</div>
                    <div style={{ flex: 1, color: '#f5f5f5', wordBreak: 'break-all' }}>
                      {fileData.filename}
                    </div>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: '80px', color: 'rgba(245, 245, 245, 0.6)' }}>Size:</div>
                    <div style={{ flex: 1, color: '#f5f5f5' }}>
                      {typeof fileData.size === 'number' ? formatFileSize(fileData.size) : 'Unknown'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: '80px', color: 'rgba(245, 245, 245, 0.6)' }}>Uploaded:</div>
                    <div style={{ flex: 1, color: '#f5f5f5' }}>
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
                    <div style={{ width: '80px', color: 'rgba(245, 245, 245, 0.6)' }}>Downloads:</div>
                    <div style={{ flex: 1, color: '#f5f5f5' }}>
                      {typeof downloadCount === 'number' ? downloadCount.toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: '80px', color: 'rgba(245, 245, 245, 0.6)' }}>Expires:</div>
                    <div style={{ flex: 1, color: '#f5f5f5' }}>
                      {getExpiresIn()}
                    </div>
                  </div>
                </div>

                {/* Primary Actions */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '0.8rem'
                  }}
                >
                  <a
                    href={downloadUrl}
                    download
                    onClick={(e) => {
                      e.preventDefault();
                      setDownloadCount((prev) => (typeof prev === 'number' ? prev + 1 : 1));
                      window.location.href = `${downloadUrl}?dl=${Date.now()}`;
                    }}
                    style={{
                      flex: 1,
                      display: 'block',
                      padding: '0.45rem 0.8rem',
                      borderRadius: '6px',
                      background: '#ffffff',
                      color: '#0a0a0a',
                      textDecoration: 'none',
                      fontWeight: 700,
                      textAlign: 'center',
                      fontSize: '0.78rem',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, opacity 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    Download
                  </a>

                  <button
                    onClick={() => {
                      if (!isPreviewable(fileData.filename)) return;
                      setPreviewLoading(true);
                      setShowPreview(true);
                    }}
                    disabled={!isPreviewable(fileData.filename)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.8rem',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: !isPreviewable(fileData.filename) ? 'rgba(245, 245, 245, 0.4)' : '#f5f5f5',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: !isPreviewable(fileData.filename) ? 'not-allowed' : 'pointer',
                      opacity: !isPreviewable(fileData.filename) ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isPreviewable(fileData.filename)) return;
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isPreviewable(fileData.filename)) return;
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Preview
                  </button>
                </div>

                {/* Copy Link Button */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/download/${pathArray.join('/')}`);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.6rem 1rem',
                    borderRadius: '6px',
                    background: isCopied ? 'rgba(79, 248, 192, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${isCopied ? 'rgba(79, 248, 192, 0.4)' : 'rgba(255, 255, 255, 0.16)'}`,
                    color: isCopied ? 'rgba(79, 248, 192, 1)' : '#f5f5f5',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCopied) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.24)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCopied) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                    }
                  }}
                >
                  {isCopied ? '✓ Copied' : 'Copy link'}
                </button>

                {/* Ad Banner */}
                <AdBanner 
                  dataAdSlot="9876543210" 
                  style={{ marginTop: '1rem' }}
                />
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
