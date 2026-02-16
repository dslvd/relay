'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { upload } from '@vercel/blob/client';
import logo from './logo.png';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  size: number;
  ip?: string;
}

interface UploadedItem {
  url: string;
  filename: string;
  size: number;
}

export default function Home() {
  const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
  const [uploadedFiles, setUploadedFiles] = useState<UploadedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadLoadedBytes, setUploadLoadedBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeView, setActiveView] = useState<'upload' | 'history'>('upload');
  const [publicHistory, setPublicHistory] = useState<UploadRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [verifyingFiles, setVerifyingFiles] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const cancelUploadRef = useRef(false);
  const emptyMessages = [
    'No uploads yet 🚀',
    'Empty for now 👀',
    'Nothing here… yet',
    'Upload something!',
    'Drop a file in ✨'
  ];
  const [emptyMessageIndex] = useState(() => Math.floor(Math.random() * emptyMessages.length));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPublicHistory();
  }, []);

  useEffect(() => {
    const handleWindowDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleWindowDragEnter = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleWindowDragLeave = (event: DragEvent) => {
      if (event.target === document || event.target === document.body) {
        setIsDragging(false);
      }
    };

    const handleWindowDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      handleFileDrop(event.dataTransfer);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  const fetchPublicHistory = async () => {
    const startTime = Date.now();
    try {
      setLoadingHistory(true);
      setVerifyingFiles(true);
      const response = await fetch('/api/history', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const records = data.history || [];

        // Verify each file still exists
        const verifiedRecords = await verifyFileExistence(records);
        setPublicHistory(verifiedRecords);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 600) {
        await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
      }
      setLoadingHistory(false);
      setVerifyingFiles(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  const generateRandomFilename = (originalFilename: string): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomName = '';
    for (let i = 0; i < 6; i++) {
      randomName += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const extension = originalFilename.includes('.') 
      ? '.' + originalFilename.split('.').pop() 
      : '';
    return randomName + extension;
  };

  const verifyFileExistence = async (records: UploadRecord[]): Promise<UploadRecord[]> => {
    const verifiedRecords: UploadRecord[] = [];
    const deletedUrls: string[] = [];

    // Check each file in batches to avoid overwhelming the server
    for (const record of records) {
      try {
        const response = await fetch(record.url, { method: 'HEAD' });
        if (response.ok) {
          verifiedRecords.push(record);
        } else {
          deletedUrls.push(record.url);
        }
      } catch (error) {
        // If fetch fails, assume file is deleted
        deletedUrls.push(record.url);
      }
    }

    // Remove deleted files from history
    if (deletedUrls.length > 0) {
      await fetch('/api/history/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: deletedUrls })
      });
    }

    return verifiedRecords;
  };

  const uploadFile = async (file: File, notify: boolean = true) => {
    cancelUploadRef.current = false;
    if (file.size > MAX_UPLOAD_BYTES) {
      if (notify) {
        showToast('File too large (max 200MB)', 'error');
      }
      throw new Error('File too large');
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');
    setUploadLoadedBytes(0);
    setUploadTotalBytes(file.size);

    try {
      const randomFilename = generateRandomFilename(file.name);
      const blob = await upload(`d/${randomFilename}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: (progress) => {
          if (cancelUploadRef.current) {
            return;
          }
          const total = progress.total ?? file.size;
          const percent = total > 0 ? Math.round((progress.loaded / total) * 100) : 0;
          setUploadProgress(Math.min(100, percent));
          setUploadStatus(`Uploading ${percent}%`);
          setUploadLoadedBytes(progress.loaded);
          setUploadTotalBytes(total);
        }
      });

      if (cancelUploadRef.current) {
        return;
      }

      const newUrl = `${window.location.origin}/${blob.pathname}`;
      setUploadedFiles(prev => [
        {
          url: newUrl,
          filename: file.name,
          size: file.size
        },
        ...prev
      ]);

      // Add to public history via API
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl,
          filename: file.name,
          size: file.size
        })
      });

      // Refresh history
      await fetchPublicHistory();
      if (notify) {
        showToast('Upload complete', 'success');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      if (notify) {
        showToast('Upload failed', 'error');
      }
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      setUploadLoadedBytes(0);
      setUploadTotalBytes(0);
    }
  };

  const uploadFiles = async (files: File[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (const [index, file] of files.entries()) {
      if (cancelUploadRef.current) {
        break;
      }
      const current = index + 1;
      showToast(`Uploading ${current} of ${files.length}`, 'info');
      try {
        await uploadFile(file, false);
        successCount += 1;
        showToast(`Uploaded ${current} of ${files.length}`, 'success');
      } catch {
        errorCount += 1;
        showToast(`Failed ${current} of ${files.length}`, 'error');
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} file${successCount === 1 ? '' : 's'} uploaded`, 'success');
    }
    if (errorCount > 0) {
      showToast('Upload failed', 'error');
    }
  };

  const cancelUpload = () => {
    if (!uploading) {
      return;
    }

    cancelUploadRef.current = true;
    setUploadStatus('');
    setUploadProgress(0);
    setUploadLoadedBytes(0);
    setUploadTotalBytes(0);
    setUploading(false);
    showToast('Upload cancelled', 'info');
  };

  const copyAllUploadedLinks = () => {
    if (uploadedFiles.length === 0) {
      showToast('No uploaded links yet', 'info');
      return;
    }

    const allLinks = uploadedFiles.map((file) => file.url).join('\n');
    copyText(allLinks, 'All links copied');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await uploadFiles(files);
    e.target.value = '';
  };

  const handleFileDrop = async (dataTransfer: DataTransfer | null) => {
    const files = Array.from(dataTransfer?.files || []);
    if (files.length === 0) return;
    setActiveView('upload');
    await uploadFiles(files);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileDrop(e.dataTransfer);
  };

  const copyText = (text: string, successMessage: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMessage, 'success');
    }).catch((err) => {
      console.error('Failed to copy to clipboard:', err);
      showToast('Copy failed', 'error');
    });
  };

  const copyToClipboard = (url: string) => {
    copyText(url, 'Copied to clipboard');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
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

  const formatShortUrl = (filename: string) => {
    return `relaycdn.vercel.app/d/${filename}`;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background: #0a0a0a;
          color: #f5f5f5;
          font-family: 'Open Sans', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        body::before {
          content: '';
          position: fixed;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: 
            radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.04) 0%, transparent 50%);
          animation: bgRotate 20s linear infinite;
          z-index: -1;
        }

        @keyframes bgRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.35);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.6);
        }
      `}} />

      <main style={{ 
        padding: '4rem 6vw',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {uploading && (
          <div style={{
            width: '100%',
            maxWidth: '860px',
            marginBottom: '1.5rem',
            padding: '0.65rem 0.9rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            background: 'rgba(10, 10, 10, 0.7)',
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={cancelUpload}
              style={{
                padding: '0.5rem 0.9rem',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                background: 'transparent',
                color: '#f5f5f5',
                fontSize: '0.8rem',
                fontWeight: 500,
                letterSpacing: '0.02em',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
            <div style={{
              fontSize: '0.78rem',
              color: '#d8d8d8',
              letterSpacing: '0.03em'
            }}>
              {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Preparing upload…'}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <button
                onClick={cancelUpload}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#f5f5f5',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={copyAllUploadedLinks}
                disabled={uploadedFiles.length === 0}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '999px',
                  border: '1px solid #ffffff',
                  background: uploadedFiles.length === 0 ? 'rgba(255, 255, 255, 0.3)' : '#ffffff',
                  color: '#0a0a0a',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  cursor: uploadedFiles.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Copy all links
              </button>
            </div>
          </div>
        )}

        {!uploading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '0.1rem'
        }}>
          <Image
            src={logo}
            alt="Logo"
            width={200}
            height={200}
            style={{}}
          />
          <h1 style={{
          fontFamily: "'Open Sans', sans-serif",
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#f5f5f5',
          animation: 'fadeSlideIn 1s ease-out',
          textAlign: 'center'
        }}>
          Quick, secure, and
          <br />
          effortless file sharing.
        </h1>
        </div>
        )}


        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {!uploading && isDragging && (
          <div
            style={{
              marginTop: '0.25rem',
              marginBottom: '1.25rem',
              width: '100%',
              maxWidth: '520px',
              padding: '1.6rem 1.5rem',
              borderRadius: '18px',
              border: '1.5px solid #ffffff',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f5f5f5',
              cursor: 'default',
              transition: 'all 0.25s ease',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div style={{
              fontSize: '0.95rem',
              letterSpacing: '0.02em',
              fontWeight: 400
            }}>
              Drop the file to upload
            </div>
            <div style={{
              marginTop: '0.35rem',
              fontSize: '0.75rem',
              color: '#9a9a9a'
            }}>
              Release to start uploading
            </div>
          </div>
        )}
        
        {!uploading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginTop: '1.25rem',
          animation: 'fadeSlideIn 1s ease-out 0.2s backwards'
        }}>
          <button
            onClick={() => setActiveView(activeView === 'history' ? 'upload' : 'history')}
            style={{
              fontFamily: "'Open Sans', sans-serif",
              padding: '0.75rem 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: activeView === 'history' ? '#f5f5f5' : '#f5f5f5',
              background: activeView === 'history' ? '#1a1a1a' : '#111111',
              border: '2px solid',
              borderColor: '#2a2a2a',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a';
              e.currentTarget.style.color = '#f5f5f5';
              e.currentTarget.style.background = '#1a1a1a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a';
              e.currentTarget.style.color = '#f5f5f5';
              e.currentTarget.style.background = activeView === 'history' ? '#1a1a1a' : '#111111';
            }}
          >
            Upload History
          </button>

          <button
            onClick={() => {
              setActiveView('upload');
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            style={{
              fontFamily: "'Open Sans', sans-serif",
              padding: '0.75rem 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: uploading ? '#666666' : '#0a0a0a',
              background: uploading ? '#f0f0f0' : '#ffffff',
              border: '2px solid',
              borderColor: uploading ? '#666666' : '#ffffff',
              borderRadius: '50px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1
            }}
            onMouseEnter={(e) => {
              if (!uploading) {
                e.currentTarget.style.borderColor = '#ffffff';
                e.currentTarget.style.color = '#0a0a0a';
                e.currentTarget.style.background = '#e6e6e6';
              }
            }}
            onMouseLeave={(e) => {
              if (!uploading) {
                e.currentTarget.style.borderColor = '#ffffff';
                e.currentTarget.style.color = '#0a0a0a';
                e.currentTarget.style.background = '#ffffff';
              }
            }}
          >
            {uploading ? 'Uploading...' : 'Choose File'}
          </button>
        </div>
        )}

        {!uploading && (
        <p style={{
          marginTop: '0.85rem',
          fontSize: '0.65rem',
          color: '#9a9a9a',
          textAlign: 'center',
          letterSpacing: '0.02em'
        }}>
          Max upload size: 200MB per file
        </p>
        )}


        {activeView === 'upload' && uploading && (
          <div style={{
            marginTop: '1.5rem',
            width: '100%',
            maxWidth: '420px',
            animation: 'fadeSlideIn 0.5s ease-out'
          }}>
            <div style={{
              height: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: 'linear-gradient(90deg, #ffffff 0%, #bfbfbf 100%)',
                transition: 'width 0.2s ease-out'
              }} />
            </div>
            <p style={{
              marginTop: '0.6rem',
              fontSize: '0.85rem',
              color: '#666666',
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              {uploadStatus || 'Uploading…'}
              {uploadTotalBytes > 0 && (
                <span> • {formatFileSize(uploadLoadedBytes)} / {formatFileSize(uploadTotalBytes)}</span>
              )}
            </p>
          </div>
        )}

        {activeView === 'upload' && uploadedFiles.length > 0 && (
          <div style={{
            marginTop: '2rem',
            animation: 'fadeSlideIn 0.8s ease-out',
            width: '100%',
            maxWidth: '720px'
          }}>
            <p style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: '#f5f5f5',
              fontWeight: 200,
              textAlign: 'center'
            }}>
              Uploaded Files • {uploadedFiles.length}
            </p>
            
            <div style={{
              maxHeight: '320px',
              overflowY: 'auto',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '18px',
              padding: '0.85rem'
            }}>
              {uploadedFiles.map((fileItem, index) => {
                const filename = fileItem.filename;
                const url = fileItem.url;
                const extension = filename.includes('.')
                  ? filename.split('.').pop()?.toUpperCase()
                  : 'FILE';

                return (
                  <div
                    key={index}
                    style={{
                      marginBottom: index < uploadedFiles.length - 1 ? '0.85rem' : '0',
                      padding: '0.95rem 1.1rem',
                      background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      transition: 'all 0.3s',
                      cursor: 'default',
                      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minWidth: 0
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '999px',
                          background: '#ffffff',
                          opacity: 0.7,
                          boxShadow: '0 0 12px rgba(255, 255, 255, 0.4)'
                        }} />
                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#f5f5f5',
                            fontWeight: 500,
                            wordBreak: 'break-all'
                          }}>
                            {formatShortUrl(filename)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#9a9a9a'
                          }}>
                            d/{filename}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.7rem',
                        color: '#f5f5f5',
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '999px',
                        letterSpacing: '0.08em'
                      }}>
                        {extension}
                      </div>
                    </div>

                    <div style={{
                      marginTop: '0.75rem',
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr',
                      gap: '0.35rem 0.9rem',
                      alignItems: 'center',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#9a9a9a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Link
                      </div>
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: '#bfbfbf',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {url}
                      </a>

                      <div style={{
                        fontSize: '0.7rem',
                        color: '#9a9a9a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Share link
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(url);
                        }}
                        style={{
                          justifySelf: 'start',
                          fontFamily: "'Open Sans', sans-serif",
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          color: '#f5f5f5',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          borderRadius: '999px',
                          padding: '0.4rem 0.85rem',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        Share link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Public Upload History */}
        {activeView === 'history' && (
        <div style={{
          marginTop: '3rem',
          width: '100%',
          maxWidth: '720px',
          animation: 'fadeSlideIn 1s ease-out 0.4s backwards'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1rem',
              fontWeight: 200,
              textAlign: 'center',
              color: '#f5f5f5'
            }}>
              Public Upload History
            </h2>
            <button
              onClick={() => !verifyingFiles && fetchPublicHistory()}
              aria-label="Refresh upload history"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: verifyingFiles ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
            >
              {verifyingFiles ? (
                <span style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '999px',
                  border: '2px solid rgba(255, 255, 255, 0.7)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }} />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.85)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              )}
            </button>
          </div>

          {loadingHistory ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#666666',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              Loading history...
            </div>
          ) : publicHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: '#666666'
            }}>
              {emptyMessages[emptyMessageIndex]}
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '18px',
              padding: '0.85rem',
              maxHeight: '320px',
              overflowY: 'auto'
            }}>
              {publicHistory.map((record, index) => {
                const extension = record.filename.includes('.')
                  ? record.filename.split('.').pop()?.toUpperCase()
                  : 'FILE';

                return (
                  <div
                    key={index}
                    style={{
                      marginBottom: index < publicHistory.length - 1 ? '0.85rem' : '0',
                      padding: '0.95rem 1.1rem',
                      background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      transition: 'all 0.3s',
                      cursor: 'default',
                      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minWidth: 0
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '999px',
                          background: '#ffffff',
                          opacity: 0.7,
                          boxShadow: '0 0 12px rgba(255, 255, 255, 0.4)'
                        }} />
                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#f5f5f5',
                            fontWeight: 500,
                            wordBreak: 'break-all'
                          }}>
                            {formatShortUrl(record.filename)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#9a9a9a'
                          }}>
                            Uploaded {formatTimestamp(record.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.7rem',
                        color: '#f5f5f5',
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '999px',
                        letterSpacing: '0.08em'
                      }}>
                        {extension}
                      </div>
                    </div>

                    <div style={{
                      marginTop: '0.75rem',
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr',
                      gap: '0.35rem 0.9rem',
                      alignItems: 'center',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#9a9a9a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Size
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#bfbfbf'
                      }}>
                        {formatFileSize(record.size)}
                      </div>


                      <div style={{
                        fontSize: '0.7rem',
                        color: '#9a9a9a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Link
                      </div>
                      <a 
                        href={record.url} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: '#bfbfbf',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.url}
                      </a>

                      <div style={{
                        fontSize: '0.7rem',
                        color: '#9a9a9a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Share link
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(record.url);
                        }}
                        style={{
                          justifySelf: 'start',
                          fontFamily: "'Open Sans', sans-serif",
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          color: '#f5f5f5',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          borderRadius: '999px',
                          padding: '0.4rem 0.85rem',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        Share link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div style={{
            marginTop: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2rem',
            flexWrap: 'wrap'
          }}>
            <p style={{
              opacity: 0.7,
              fontSize: '0.8rem',
              color: '#666666',
              margin: 0
            }}>
              Showing {publicHistory.length} recent uploads {verifyingFiles ? '• Verifying files...' : ''}
            </p>
          </div>
        </div>
        )}

        {/* Toast Notifications */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            background: toast.type === 'error' ? '#1a1a1a' : '#ffffff',
            color: toast.type === 'error' ? '#f5f5f5' : '#0a0a0a',
            padding: '0.65rem 0.95rem',
            borderRadius: '10px',
            boxShadow: '0 10px 26px rgba(0, 0, 0, 0.35)',
            border: toast.type === 'error' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #ffffff',
            animation: 'fadeSlideIn 0.25s ease-out',
            zIndex: 1000,
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.02em'
          }}>
            {toast.message}
          </div>
        )}
      </main>
    </>
  );
}