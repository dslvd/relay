'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  size: number;
}

export default function DownloadPage() {
  const params = useParams();
  const pathArray = Array.isArray(params.path) ? params.path : [params.path];
  const filename = pathArray[pathArray.length - 1];
  
  const [fileData, setFileData] = useState<UploadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const downloadUrl = `/d/${pathArray.join('/')}`;

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
        const response = await fetch('/api/history', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          const records = data.history || [];
          const file = records.find((r: UploadRecord) => r.url.includes(pathArray.join('/')));
          if (file) {
            setFileData(file);
          } else {
            setNotFound(true);
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
  }, [pathArray]);

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

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.06) 0%, transparent 45%), radial-gradient(circle at 85% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 45%), #0a0a0a',
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

      {/* DMCA - Fixed Bottom Right */}
      <a
        href="/dmca"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 50,
          textDecoration: 'none',
          fontSize: '0.75rem',
          color: 'rgba(245, 245, 245, 0.5)',
          transition: 'color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'rgba(245, 245, 245, 0.8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(245, 245, 245, 0.5)';
        }}
      >
        DMCA
      </a>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 6vw'
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
              width: 'min(600px, 92vw)',
              borderRadius: '28px',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '3rem',
              boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(245, 245, 245, 0.55)',
                marginBottom: '0.9rem'
              }}
            >
              404
            </div>
            <h1
              style={{
                margin: '0 0 0.6rem',
                fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
                letterSpacing: '-0.02em'
              }}
            >
              File not found
            </h1>
            <p
              style={{
                margin: 0,
                color: 'rgba(245, 245, 245, 0.7)',
                fontSize: '1rem',
                marginBottom: '2rem'
              }}
            >
              The file you're looking for doesn't exist or has expired.
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.7rem 1.2rem',
                borderRadius: '999px',
                background: '#ffffff',
                color: '#0a0a0a',
                textDecoration: 'none',
                fontWeight: 700
              }}
            >
              Upload a new file
            </a>
          </section>
        ) : (
          <section
            style={{
              width: 'min(600px, 92vw)',
              borderRadius: '28px',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '3rem',
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
                    padding: '0.5rem 0.9rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#f5f5f5',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginBottom: '1.5rem'
                  }}
                >
                  ← Back to details
                </button>

                {/* Preview Content */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                  {getFileType(fileData.filename) === 'image' && (
                    <img src={downloadUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }} />
                  )}
                  {getFileType(fileData.filename) === 'video' && (
                    <video controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }}>
                      <source src={downloadUrl} />
                      Your browser does not support the video tag.
                    </video>
                  )}
                  {getFileType(fileData.filename) === 'pdf' && (
                    <iframe src={downloadUrl} style={{ width: '100%', height: '100%', borderRadius: '12px', border: 'none' }} />
                  )}
                  {getFileType(fileData.filename) === 'text' && (
                    <iframe src={downloadUrl} style={{ width: '100%', height: '100%', borderRadius: '12px', border: 'none' }} />
                  )}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: '0.8rem',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: 'rgba(245, 245, 245, 0.55)',
                    marginBottom: '0.9rem'
                  }}
                >
                  Download
                </div>
                <h1
                  style={{
                    margin: '0 0 1.2rem',
                    fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
                    letterSpacing: '-0.02em',
                    wordBreak: 'break-word'
                  }}
                >
                  {fileData.filename}
                </h1>

                {/* File Details */}
                <div
                  style={{
                    padding: '1.2rem 1.4rem',
                    borderRadius: '18px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    marginBottom: '2rem'
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'rgba(245, 245, 245, 0.55)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.4rem'
                        }}
                      >
                        File size
                      </div>
                      <div
                        style={{
                          fontSize: '1rem',
                          color: '#f5f5f5',
                          fontWeight: 500
                        }}
                      >
                        {formatFileSize(fileData.size)}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'rgba(245, 245, 245, 0.55)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.4rem'
                        }}
                      >
                        Uploaded
                      </div>
                      <div
                        style={{
                          fontSize: '1rem',
                          color: '#f5f5f5',
                          fontWeight: 500
                        }}
                      >
                        {formatDate(fileData.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download & Preview Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: isPreviewable(fileData.filename) ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                  <a
                    href={downloadUrl}
                    download
                    style={{
                      display: 'block',
                      padding: '0.9rem 1.2rem',
                      borderRadius: '999px',
                      background: '#ffffff',
                      color: '#0a0a0a',
                      textDecoration: 'none',
                      fontWeight: 700,
                      textAlign: 'center',
                      fontSize: '1rem',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    ⬇ Download
                  </a>
                  {isPreviewable(fileData.filename) && (
                    <button
                      onClick={() => setShowPreview(true)}
                      style={{
                        padding: '0.9rem 1.2rem',
                        borderRadius: '999px',
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        color: '#f5f5f5',
                        fontWeight: 700,
                        textAlign: 'center',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      👁 Preview
                    </button>
                  )}
                </div>
              </>
            )}
          </section>        )}      </div>
    </main>
  );
}
