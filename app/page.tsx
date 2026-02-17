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
  timestamp: number;
}

export default function Home() {
  const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
  const [uploadedFiles, setUploadedFiles] = useState<UploadedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadLoadedBytes, setUploadLoadedBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [currentUploadName, setCurrentUploadName] = useState('');
  const [uploadFilePreview, setUploadFilePreview] = useState<string>('');
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
    setCurrentUploadName(file.name);
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast('File too large (max 200MB)', 'error');
      throw new Error('File too large');
    }

    // Generate preview for images and videos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (file.type.startsWith('video/')) {
          // For videos, extract a frame (use the video element)
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              setUploadFilePreview(canvas.toDataURL('image/jpeg', 0.7));
            }
          };
          video.src = e.target?.result as string;
        } else {
          // For images, use directly
          setUploadFilePreview(e.target?.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setUploadFilePreview('');
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

      // Extract filename from blob.pathname (e.g., 'd/randomname.ext') and create download page URL
      const filename = blob.pathname.split('/').pop() || '';
      const newUrl = `${window.location.origin}/download/${filename}`;
      const uploadedAt = Date.now();

      setUploadedFiles(prev => [
        {
          url: newUrl,
          filename: file.name,
          size: file.size,
          timestamp: uploadedAt
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
      setUploadFilePreview('');
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
      } catch (error) {
        errorCount += 1;
        if (error instanceof Error && error.message === 'File too large') {
          continue;
        }
        showToast(`Failed ${current} of ${files.length}`, 'error');
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} file${successCount === 1 ? '' : 's'} uploaded`, 'success');
    }
    if (errorCount > 0) {
      showToast('Upload failed', 'error');
    }

    setCurrentUploadName('');
  };

  const cancelUpload = () => {
    if (!uploading) {
      return;
    }

    cancelUploadRef.current = true;
    setCurrentUploadName('');
    setUploadStatus('');
    setUploadProgress(0);
    setUploadLoadedBytes(0);
    setUploadTotalBytes(0);
    setUploading(false);
    showToast('Upload cancelled', 'info');
  };

  const getDownloadLinks = (): string[] => {
    return uploadedFiles.map(file => {
      // For files uploaded in this session, the URL is already the download page link
      if (file.url.includes('/download/')) {
        return file.url;
      }
      // For legacy files or if needed, extract filename and create download page URL
      const filename = file.url.split('/').pop() || '';
      return `${window.location.origin}/download/${filename}`;
    });
  };

  const copyAllUploadedLinks = () => {
    if (uploadedFiles.length === 0) {
      showToast('No uploaded links yet', 'info');
      return;
    }

    const allLinks = getDownloadLinks().join('\n');
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

  const formatDisplayName = (filename: string) => {
    return filename;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background: #0a0a0a;
          color: #eef1f6;
          font-family: 'Sora', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
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
          background: rgba(255, 255, 255, 0.04);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.35);
        }
      `}} />

      <main style={{ 
        padding: uploading ? '6.5rem 6vw 4rem' : '4rem 6vw',
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
            maxWidth: '1200px',
            marginBottom: '1.5rem',
            padding: '0.75rem 1.2rem',
            borderRadius: '0 0 18px 18px',
            border: '1px solid #1f232b',
            borderTop: 'none',
            background: '#111318',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            marginLeft: 'auto',
            marginRight: 'auto',
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
                border: '1px solid #262a33',
                background: '#14161b',
                color: '#eef1f6',
                fontSize: '0.8rem',
                fontWeight: 500,
                letterSpacing: '0.02em',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
            {uploadFilePreview && (
              <img
                src={uploadFilePreview}
                alt="Upload preview"
                style={{
                  height: '32px',
                  width: '32px',
                  borderRadius: '6px',
                  objectFit: 'cover',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              />
            )}
            <div style={{
              fontSize: '0.78rem',
              color: '#c3cad6',
              letterSpacing: '0.03em'
            }}>
              {currentUploadName ? `${currentUploadName} • ` : ''}
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
                  border: '1px solid #262a33',
                  background: '#14161b',
                  color: '#eef1f6',
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
                  border: '1px solid #e9ecf2',
                  background: uploadedFiles.length === 0 ? '#2a2f3a' : '#e9ecf2',
                  color: uploadedFiles.length === 0 ? '#8a92a1' : '#0b0c10',
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
          fontFamily: "'Sora', sans-serif",
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#eef1f6',
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
              border: '1px dashed #2a2f3a',
              background: '#14161b',
              color: '#eef1f6',
              cursor: 'default',
              transition: 'border-color 0.2s ease'
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
              color: '#8a92a1'
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
              fontFamily: "'Sora', sans-serif",
              padding: '0.75rem 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: '#eef1f6',
              background: activeView === 'history' ? '#181c22' : '#14161b',
              border: '1px solid #242833',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2f3541';
              e.currentTarget.style.background = '#181c22';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#242833';
              e.currentTarget.style.background = activeView === 'history' ? '#181c22' : '#14161b';
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
              fontFamily: "'Sora', sans-serif",
              padding: '0.75rem 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: uploading ? '#8a92a1' : '#0b0c10',
              background: uploading ? '#2a2f3a' : '#e9ecf2',
              border: '1px solid',
              borderColor: uploading ? '#2a2f3a' : '#e9ecf2',
              borderRadius: '50px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1
            }}
            onMouseEnter={(e) => {
              if (!uploading) {
                e.currentTarget.style.borderColor = '#d6dbe4';
                e.currentTarget.style.color = '#0b0c10';
                e.currentTarget.style.background = '#dfe4ee';
              }
            }}
            onMouseLeave={(e) => {
              if (!uploading) {
                e.currentTarget.style.borderColor = '#e9ecf2';
                e.currentTarget.style.color = '#0b0c10';
                e.currentTarget.style.background = '#e9ecf2';
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
          fontSize: '0.5rem',
          color: '#8a92a1',
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
            {currentUploadName && (
              <div style={{
                marginBottom: '0.35rem',
                fontSize: '0.78rem',
                color: '#b5bcc9',
                textAlign: 'center'
              }}>
                {currentUploadName}
              </div>
            )}
            <div style={{
              height: '8px',
              background: '#1a1e26',
              borderRadius: '999px',
              overflow: 'hidden',
              border: '1px solid #242833'
            }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: '#e9ecf2',
                transition: 'width 0.2s ease-out'
              }} />
            </div>
            <p style={{
              marginTop: '0.6rem',
              fontSize: '0.85rem',
              color: '#8a92a1',
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
              color: '#eef1f6',
              fontWeight: 500,
              textAlign: 'center'
            }}>
              Uploaded Files • {uploadedFiles.length}
            </p>
            
            <div style={{
              maxHeight: '320px',
              overflowY: 'auto',
              background: '#111318',
              border: '1px solid #1f232b',
              borderRadius: '16px',
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
                      background: '#14161b',
                      border: '1px solid #22262f',
                      borderRadius: '16px',
                      transition: 'border-color 0.2s ease',
                      cursor: 'default'
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
                          background: '#e9ecf2',
                          opacity: 0.8
                        }} />
                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#eef1f6',
                            fontWeight: 500,
                            wordBreak: 'break-all'
                          }}>
                            {formatDisplayName(filename)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#8a92a1'
                          }}>
                            Uploaded {formatTimestamp(fileItem.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem'
                      }}>
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#eef1f6',
                          background: '#1a1e26',
                          border: '1px solid #262a33',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          letterSpacing: '0.08em'
                        }}>
                          {extension}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(url);
                          }}
                          aria-label="Share link"
                          title="Share link"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            border: '1px solid #262a33',
                            background: '#14161b',
                            color: '#e9ecf2',
                            fontSize: '0.9rem',
                            lineHeight: '1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          ⤴
                        </button>
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
                        color: '#8a92a1',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Link
                      </div>
                      <a 
                        href={url.includes('/download/') ? url : `${window.location.origin}/download/${url.split('/').pop()}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: '#b5bcc9',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {url}
                      </a>

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
              fontWeight: 500,
              textAlign: 'center',
              color: '#eef1f6'
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
                border: '1px solid #262a33',
                background: '#14161b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: verifyingFiles ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.borderColor = '#2f3541';
                  e.currentTarget.style.background = '#181c22';
                }
              }}
              onMouseLeave={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.borderColor = '#262a33';
                  e.currentTarget.style.background = '#14161b';
                }
              }}
            >
              {verifyingFiles ? (
                <span style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '999px',
                  border: '2px solid rgba(233, 236, 242, 0.7)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }} />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(233, 236, 242, 0.9)"
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
              color: '#8a92a1',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              Loading history...
            </div>
          ) : publicHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: '#111318',
              border: '1px solid #1f232b',
              borderRadius: '12px',
              color: '#8a92a1'
            }}>
              {emptyMessages[emptyMessageIndex]}
            </div>
          ) : (
            <div style={{
              background: '#111318',
              border: '1px solid #1f232b',
              borderRadius: '16px',
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
                      background: '#14161b',
                      border: '1px solid #22262f',
                      borderRadius: '16px',
                      transition: 'border-color 0.2s ease',
                      cursor: 'default'
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
                          background: '#e9ecf2',
                          opacity: 0.8
                        }} />
                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#eef1f6',
                            fontWeight: 500,
                            wordBreak: 'break-all'
                          }}>
                            {formatDisplayName(record.filename)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#8a92a1'
                          }}>
                            Uploaded {formatTimestamp(record.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem'
                      }}>
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#eef1f6',
                          background: '#1a1e26',
                          border: '1px solid #262a33',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          letterSpacing: '0.08em'
                        }}>
                          {extension}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(record.url);
                          }}
                          aria-label="Share link"
                          title="Share link"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            border: '1px solid #262a33',
                            background: '#14161b',
                            color: '#e9ecf2',
                            fontSize: '0.9rem',
                            lineHeight: '1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          ⤴
                        </button>
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
                        color: '#8a92a1',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Size
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#b5bcc9'
                      }}>
                        {formatFileSize(record.size)}
                      </div>


                      <div style={{
                        fontSize: '0.7rem',
                        color: '#8a92a1',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        Link
                      </div>
                      <a 
                        href={record.url.includes('/download/') ? record.url : `${window.location.origin}/download/${record.url.split('/').pop()}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: '#b5bcc9',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.url}
                      </a>

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
              color: '#8a92a1',
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
            background: '#14161b',
            color: '#eef1f6',
            padding: '0.65rem 0.95rem',
            borderRadius: '10px',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
            border: '1px solid #242833',
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