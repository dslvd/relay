'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
// import AdBanner from './components/AdBanner';
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
  const FREE_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
  const PREMIUM_MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
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
  const [isPremium, setIsPremium] = useState(false);
  const [premiumEmail, setPremiumEmail] = useState('');
  const toastTimeoutRef = useRef<number | null>(null);
  const cancelUploadRef = useRef(false);
  const activeUploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const emptyMessages = [
    'No uploads yet 🚀',
    'Empty for now 👀',
    'Nothing here… yet',
    'Upload something!',
    'Drop a file in ✨'
  ];
  const [emptyMessageIndex] = useState(() => Math.floor(Math.random() * emptyMessages.length));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxUploadBytes = isPremium ? PREMIUM_MAX_UPLOAD_BYTES : FREE_MAX_UPLOAD_BYTES;

  useEffect(() => {
    fetch('/api/premium/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        setIsPremium(Boolean(data.premium));
        setPremiumEmail(data?.user?.email || '');
      })
      .catch(() => {
        setIsPremium(false);
        setPremiumEmail('');
      });

    // Track page view
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageview', path: '/' })
    }).catch(() => {}); // Silently fail
    
    fetchPublicHistory();
  }, []);

  const logoutPremium = async () => {
    try {
      await fetch('/api/premium/logout', { method: 'POST' });
      setIsPremium(false);
      setPremiumEmail('');
      showToast('Premium logout successful', 'info');
    } catch {
      showToast('Failed to logout premium account', 'error');
    }
  };

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

    const handleVisibilityChange = () => {
      if (document.hidden && uploading) {
        // User switched tabs during upload - warn them
        console.warn('Tab switched during upload. Upload may be throttled by browser.');
        showToast('⚠️ Keep this tab open during upload!', 'info');
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [uploading]);

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
    // Check each file and only remove records on confirmed 404 responses.
    for (const record of records) {
      try {
        const parsed = new URL(record.url);
        const filename = parsed.pathname.split('/').pop();
        const probeUrl = filename ? `/d/${filename}` : parsed.pathname;
        const response = await fetch(probeUrl, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) {
          verifiedRecords.push(record);
        } else if (response.status === 404) {
          deletedUrls.push(record.url);
        } else {
          // Keep record on transient errors (403/429/5xx/etc).
          verifiedRecords.push(record);
        }
      } catch {
        // Keep record when network checks fail; don't wipe history on transient issues.
        verifiedRecords.push(record);
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

  const uploadToPresignedUrl = (
    uploadUrl: string,
    file: File,
    onProgress: (loaded: number, total: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeUploadRequestRef.current = xhr;

      xhr.open('PUT', uploadUrl, true);
      if (file.type) {
        xhr.setRequestHeader('Content-Type', file.type);
      }

      xhr.upload.onprogress = (event) => {
        const total = event.total || file.size;
        onProgress(event.loaded, total);
      };

      xhr.onload = () => {
        activeUploadRequestRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        reject(new Error(`Upload failed with status ${xhr.status}`));
      };

      xhr.onerror = () => {
        activeUploadRequestRef.current = null;
        reject(new Error('Upload request failed'));
      };

      xhr.onabort = () => {
        activeUploadRequestRef.current = null;
        reject(new Error('Upload cancelled'));
      };

      xhr.send(file);
    });
  };

  const uploadFile = async (file: File, notify: boolean = true) => {
    cancelUploadRef.current = false;
    setCurrentUploadName(file.name);
    if (file.size > maxUploadBytes) {
      showToast(`File is too large (max ${formatFileSize(maxUploadBytes)})`, 'error');
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
      const pathname = `d/${randomFilename}`;

      const initResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      });

      const initPayload = await initResponse.json();
      if (!initResponse.ok || !initPayload?.uploadUrl) {
        throw new Error(initPayload?.error || 'Failed to initialize upload');
      }

      await uploadToPresignedUrl(initPayload.uploadUrl, file, (loaded, total) => {
        if (cancelUploadRef.current) {
          return;
        }
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
        setUploadProgress(Math.min(100, percent));
        setUploadStatus(`Uploading ${percent}%`);
        setUploadLoadedBytes(loaded);
        setUploadTotalBytes(total);
      });

      if (cancelUploadRef.current) {
        return;
      }

      const filename = pathname.split('/').pop() || '';
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

      // Persist upload in history.
      const historyResponse = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl,
          filename: file.name,
          size: file.size
        })
      });

      if (!historyResponse.ok) {
        const errorPayload = await historyResponse.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'Failed to save upload history');
      }

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
      activeUploadRequestRef.current = null;
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
          showToast('File is too large', 'error');
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
    activeUploadRequestRef.current?.abort();
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
          background: radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%);
          background-attachment: fixed;
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

        @keyframes slideSide {
          0%   { transform: translateX(0) scaleX(1); opacity: 1; }
          35%  { transform: translateX(0) scaleX(1); opacity: 1; }
          48%  { transform: translateX(600px) scaleX(1.3); opacity: 0; }
          49%  { transform: translateX(-600px) scaleX(1.3); opacity: 0; }
          62%  { transform: translateX(0) scaleX(1); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }

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
            border: '1px solid rgba(255,255,255,0.1)',
            borderTop: 'none',
            background: 'rgba(17,19,24,0.65)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
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
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: '#eef1f6',
                fontSize: '0.8rem',
                fontWeight: 500,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
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
              letterSpacing: '0.03em',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem'
            }}>
              <div>
                {currentUploadName ? `${currentUploadName} • ` : ''}
                {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Preparing upload…'}
              </div>
              <div style={{ 
                fontSize: '0.65rem', 
                color: '#858d9d',
                fontStyle: 'italic'
              }}>
                Keep this tab open during upload
              </div>
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
                  border: '1px solid rgba(255,255,255,0.13)',
                  background: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#eef1f6',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
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
                  border: uploadedFiles.length === 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(233,236,242,0.5)',
                  background: uploadedFiles.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(233,236,242,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: uploadedFiles.length === 0 ? '#8a92a1' : '#eef1f6',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  cursor: uploadedFiles.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
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
               style={{
                 animation: 'slideSide 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite'
               }}
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
          <div
            style={{
              marginTop: '0.2rem',
              width: '100%',
              maxWidth: '520px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.72rem',
                color: '#b5bcc9',
                letterSpacing: '0.02em'
              }}
            >
              {isPremium ? (
                <span style={{ color: '#8a92a1' }}>
                  {premiumEmail || 'Active'}
                </span>
              ) : (
                <span style={{ color: '#8a92a1' }}>
                  Premium = Higher limits + no ads
                </span>
              )}
            </div>

            {isPremium ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <a
                  href="/premium/dashboard"
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.13)',
                    background: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#c3cad6',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  Dashboard
                </a>
                <button
                  onClick={logoutPremium}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.13)',
                    background: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#c3cad6',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <a
                href="/premium"
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(233,236,242,0.35)',
                  background: 'rgba(233,236,242,0.15)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  color: '#eef1f6',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                Premium login
              </a>
            )}
          </div>
        </div>
        )}

        {!uploading && (
          <p
            style={{
              marginTop: '0.4rem',
              marginBottom: '0.2rem',
              fontSize: '0.7rem',
              color: '#8a92a1',
              textAlign: 'center',
              letterSpacing: '0.03em'
            }}
          >
          </p>
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
              border: '1px dashed rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#eef1f6',
              cursor: 'default',
              transition: 'border-color 0.2s ease',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
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
          marginTop: '0.20rem',
          animation: 'fadeSlideIn 1s ease-out 0.2s backwards'
        }}>
          <button
            onClick={() => setActiveView(activeView === 'history' ? 'upload' : 'history')}
            style={{
              fontFamily: "'Sora', sans-serif",
              padding: '0.42rem 1.55rem',
              fontSize: '0.82rem',
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: '#eef1f6',
              background: activeView === 'history' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.13)',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = activeView === 'history' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
            }}
          >
            Uploads
          </button>

          <button
            onClick={() => {
              setActiveView('upload');
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            style={{
              fontFamily: "'Sora', sans-serif",
              padding: '0.42rem 1.55rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: uploading ? 'rgba(255,255,255,0.35)' : '#eef1f6',
              background: uploading ? 'rgba(255,255,255,0.04)' : 'rgba(233,236,242,0.18)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: uploading ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(233,236,242,0.35)',
              borderRadius: '50px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1,
              boxShadow: uploading ? 'none' : '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}
            onMouseEnter={(e) => {
              if (!uploading) {
                e.currentTarget.style.background = 'rgba(233,236,242,0.26)';
                e.currentTarget.style.borderColor = 'rgba(233,236,242,0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!uploading) {
                e.currentTarget.style.background = 'rgba(233,236,242,0.18)';
                e.currentTarget.style.borderColor = 'rgba(233,236,242,0.35)';
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
          fontSize: '0.6rem',
          color: '#8a92a1',
          textAlign: 'center',
          letterSpacing: '0.02em'
        }}>
          Max upload size: {formatFileSize(maxUploadBytes)} per file {isPremium ? '• Premium' : '• Free'}
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
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '999px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)'
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
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '0.85rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)'
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
                      background: 'rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: '16px',
                      transition: 'border-color 0.2s ease',
                      cursor: 'default',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
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
                          background: 'rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.13)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          letterSpacing: '0.08em',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)'
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
                            border: '1px solid rgba(255,255,255,0.13)',
                            background: 'rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            color: '#e9ecf2',
                            fontSize: '0.9rem',
                            lineHeight: '1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
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

        {/* Minimal: AdBanner removed for cleaner look */}

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
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: verifyingFiles ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
              onMouseEnter={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.13)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
                }
              }}
              onMouseLeave={(e) => {
                if (!verifyingFiles) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
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
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '12px',
              color: '#8a92a1',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)'
            }}>
              {emptyMessages[emptyMessageIndex]}
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '0.85rem',
              maxHeight: '320px',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)'
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
                      background: 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.11)',
                      borderRadius: '16px',
                      transition: 'border-color 0.2s ease, background 0.2s ease',
                      cursor: 'default',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
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
                          background: 'rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.13)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          letterSpacing: '0.08em',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)'
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
                            border: '1px solid rgba(255,255,255,0.13)',
                            background: 'rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            color: '#e9ecf2',
                            fontSize: '0.9rem',
                            lineHeight: '1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
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
            background: 'rgba(20,22,27,0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            color: '#eef1f6',
            padding: '0.65rem 0.95rem',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
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
