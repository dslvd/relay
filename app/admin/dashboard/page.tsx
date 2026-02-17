'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  size: number;
  ip?: string;
}

interface AnalyticsData {
  pageViews: {
    total: number;
    last24h: number;
    last7days: number;
  };
  visitors: {
    unique: number;
    unique24h: number;
    live: number;
  };
  downloads: {
    total: number;
    last24h: number;
    last7days: number;
  };
  topFiles: Array<{
    filename: string;
    totalDownloads: number;
    last24h: number;
    last7days: number;
    uniqueUsers: number;
  }>;
  recentDownloads: Array<{
    filename: string;
    timestamp: number;
    ip: string;
  }>;
}

type SortKey = 'filename' | 'size' | 'timestamp' | 'ip';
type SortOrder = 'asc' | 'desc';

export default function AdminDashboard() {
  const [files, setFiles] = useState<UploadRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const isAuth = sessionStorage.getItem('admin_authenticated');
    if (!isAuth) {
      router.push('/admin');
      return;
    }

    fetchFiles();
    
    // Auto-refresh analytics every 30 seconds
    const interval = setInterval(() => {
      fetchFiles();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [router]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const [historyResponse, analyticsResponse] = await Promise.all([
        fetch('/api/history', { cache: 'no-store' }),
        fetch('/api/analytics', { cache: 'no-store' })
      ]);
      
      if (historyResponse.ok) {
        const data = await historyResponse.json();
        setFiles(data.history || []);
      }
      
      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (url: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
      setDeleting(url);
      const response = await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        await fetchFiles();
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const clearAllFiles = async () => {
    if (!confirm('Delete ALL files? This cannot be undone!')) return;
    if (!confirm('Are you ABSOLUTELY sure? All files will be permanently deleted!')) return;

    try {
      setLoading(true);
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' })
      });

      if (response.ok) {
        await fetchFiles();
        alert('All files deleted successfully');
      } else {
        alert('Failed to delete files');
      }
    } catch (error) {
      console.error('Failed to clear files:', error);
      alert('Failed to delete files');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('admin_authenticated');
    router.push('/admin');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.url)));
    }
  };

  const toggleSelectFile = (url: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedFiles(newSelected);
  };

  const deleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    if (!confirm(`Delete ${selectedFiles.size} selected file(s)?`)) return;

    try {
      setLoading(true);
      const deletePromises = Array.from(selectedFiles).map(url =>
        fetch('/api/admin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })
      );
      await Promise.all(deletePromises);
      setSelectedFiles(new Set());
      await fetchFiles();
    } catch (error) {
      console.error('Failed to delete files:', error);
      alert('Failed to delete some files');
    } finally {
      setLoading(false);
    }
  };

  const exportData = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const dataStr = JSON.stringify(files, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `upload-history-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Filename', 'URL', 'Size (bytes)', 'Uploaded', 'IP'];
      const rows = files.map(f => [
        f.filename,
        f.url,
        f.size.toString(),
        new Date(f.timestamp).toISOString(),
        f.ip || 'Unknown'
      ]);
      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const dataBlob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `upload-history-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getFileExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (file.ip && file.ip.includes(searchQuery));
    
    if (!matchesSearch) return false;
    
    if (filterType === 'all') return true;
    
    const ext = getFileExtension(file.filename);
    if (filterType === 'images') return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    if (filterType === 'videos') return ['mp4', 'webm', 'mov', 'avi'].includes(ext);
    if (filterType === 'documents') return ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext);
    
    return true;
  }).sort((a, b) => {
    let aVal: any = a[sortKey];
    let bVal: any = b[sortKey];
    
    if (sortKey === 'filename' || sortKey === 'ip') {
      aVal = (aVal || '').toLowerCase();
      bVal = (bVal || '').toLowerCase();
    }
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const uploadsToday = files.filter(f => {
    const today = new Date();
    const uploadDate = new Date(f.timestamp);
    return uploadDate.toDateString() === today.toDateString();
  }).length;
  const uniqueIPs = new Set(files.map(f => f.ip).filter(Boolean)).size;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.05) 0%, transparent 55%), #0a0a0a',
      color: '#f5f5f5',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontFamily: "'Open Sans', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 300,
              marginBottom: '0.5rem'
            }}>
              🛠️ Admin Dashboard
            </h1>
            <p style={{
              fontSize: '0.9rem',
              color: '#666666'
            }}>
              Manage all uploads and monitor activity
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={fetchFiles}
              disabled={loading}
              style={{
                padding: '0.625rem 1.25rem',
                background: '#111111',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '999px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Open Sans', sans-serif"
              }}
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>

            <button
              onClick={logout}
              style={{
                padding: '0.625rem 1.25rem',
                background: '#ffffff',
                border: '1px solid #ffffff',
                borderRadius: '999px',
                color: '#0a0a0a',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif"
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#666666', marginBottom: '0.5rem' }}>Total Files</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{files.length}</div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#666666', marginBottom: '0.5rem' }}>Total Storage</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatFileSize(totalSize)}</div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#666666', marginBottom: '0.5rem' }}>Uploads Today</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{uploadsToday}</div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#666666', marginBottom: '0.5rem' }}>Unique IPs</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{uniqueIPs}</div>
          </div>
        </div>

        {/* Analytics Section */}
        {analytics && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 300,
                color: '#f5f5f5',
                margin: 0
              }}>
                📊 Analytics Dashboard
              </h3>
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  color: '#f5f5f5',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif"
                }}
              >
                {showAnalytics ? 'Hide' : 'Show'}
              </button>
            </div>

            {showAnalytics && (
              <>
                {/* Analytics Stats Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.5rem' }}>🔴 Live Visitors</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.visitors.live}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666666' }}>Last 5 minutes</div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.5rem' }}>👥 Unique Visitors (24h)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.visitors.unique24h}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666666' }}>Total: {analytics.visitors.unique}</div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.5rem' }}>📄 Page Views (24h)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.pageViews.last24h}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666666' }}>Total: {analytics.pageViews.total}</div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.5rem' }}>⬇️ Downloads (24h)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.downloads.last24h}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666666' }}>Total: {analytics.downloads.total}</div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.5rem' }}>📈 7-Day Page Views</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{analytics.pageViews.last7days}</div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.5rem' }}>📈 7-Day Downloads</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{analytics.downloads.last7days}</div>
                  </div>
                </div>

                {/* Top Downloaded Files */}
                {analytics.topFiles && analytics.topFiles.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#f5f5f5',
                      marginBottom: '1rem'
                    }}>
                      🏆 Most Downloaded Files
                    </h4>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        {analytics.topFiles.slice(0, 10).map((file, index) => (
                          <div
                            key={index}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '40px 1fr auto auto auto',
                              gap: '1rem',
                              alignItems: 'center',
                              padding: '1rem',
                              borderBottom: index < analytics.topFiles.slice(0, 10).length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
                            }}
                          >
                            <div style={{
                              fontSize: '1.2rem',
                              fontWeight: 700,
                              color: index < 3 ? '#FFD700' : '#666666',
                              textAlign: 'center'
                            }}>
                              #{index + 1}
                            </div>
                            <div style={{
                              fontSize: '0.875rem',
                              color: '#f5f5f5',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {file.filename}
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: '#666666',
                              whiteSpace: 'nowrap'
                            }}>
                              <strong>{file.totalDownloads}</strong> total
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: '#666666',
                              whiteSpace: 'nowrap'
                            }}>
                              {file.last24h} today
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: '#666666',
                              whiteSpace: 'nowrap'
                            }}>
                              {file.uniqueUsers} users
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Downloads */}
                {analytics.recentDownloads && analytics.recentDownloads.length > 0 && (
                  <div>
                    <h4 style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#f5f5f5',
                      marginBottom: '1rem'
                    }}>
                      🕒 Recent Downloads
                    </h4>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {analytics.recentDownloads.slice(0, 10).map((download, index) => (
                          <div
                            key={index}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto auto',
                              gap: '1rem',
                              alignItems: 'center',
                              padding: '0.75rem 1rem',
                              borderBottom: index < analytics.recentDownloads.slice(0, 10).length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
                            }}
                          >
                            <div style={{
                              fontSize: '0.85rem',
                              color: '#f5f5f5',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {download.filename}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#666666',
                              fontFamily: 'monospace'
                            }}>
                              {download.ip}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#666666',
                              whiteSpace: 'nowrap'
                            }}>
                              {formatTimeAgo(download.timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Search, Filter & Export */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Search files, URLs, or IPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 300px',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                outline: 'none',
                fontFamily: "'Open Sans', sans-serif"
              }}
            />
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif"
              }}
            >
              <option value="all">All Types</option>
              <option value="images">Images</option>
              <option value="videos">Videos</option>
              <option value="documents">Documents</option>
            </select>

            <button
              onClick={() => exportData('json')}
              style={{
                padding: '0.75rem 1rem',
                background: '#111111',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif"
              }}
            >
              📥 Export JSON
            </button>

            <button
              onClick={() => exportData('csv')}
              style={{
                padding: '0.75rem 1rem',
                background: '#111111',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif"
              }}
            >
              📥 Export CSV
            </button>
          </div>

          {selectedFiles.size > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#666666', fontSize: '0.875rem' }}>
                {selectedFiles.size} selected
              </span>
              <button
                onClick={deleteSelected}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#111111',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  color: '#f5f5f5',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif"
                }}
              >
                🗑️ Delete Selected
              </button>
              <button
                onClick={() => setSelectedFiles(new Set())}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  color: '#f5f5f5',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif"
                }}
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{
            fontSize: '1rem',
          fontWeight: 300,
            marginBottom: '0.75rem',
          color: '#f5f5f5'
          }}>
            ⚠️ Danger Zone
          </h3>
          <button
            onClick={clearAllFiles}
            disabled={loading || files.length === 0}
            style={{
              padding: '0.625rem 1.25rem',
            background: '#111111',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '999px',
            color: '#f5f5f5',
              fontSize: '0.875rem',
            fontWeight: 400,
            letterSpacing: '0.02em',
              cursor: loading || files.length === 0 ? 'not-allowed' : 'pointer',
              opacity: loading || files.length === 0 ? 0.5 : 1,
              fontFamily: "'Open Sans', sans-serif"
            }}
          >
            🗑️ Delete All Files
          </button>
        </div>

        {/* Files List */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#666666'
          }}>
            Loading files...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            color: '#666666'
          }}>
            {searchQuery || filterType !== 'all' ? 'No files match your filters' : 'No files uploaded yet'}
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            overflow: 'auto'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '800px'
            }}>
              <thead>
                <tr style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    width: '50px'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th 
                    onClick={() => toggleSort('filename')}
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#666666',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Filename {sortKey === 'filename' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => toggleSort('size')}
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#666666',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Size {sortKey === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => toggleSort('timestamp')}
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#666666',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Uploaded {sortKey === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => toggleSort('ip')}
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#666666',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    IP Address {sortKey === 'ip' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#666666'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: index < filteredFiles.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                      background: selectedFiles.has(file.url) ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
                    }}
                  >
                    <td style={{
                      padding: '1rem',
                      textAlign: 'center'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.url)}
                        onChange={() => toggleSelectFile(file.url)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    <td style={{
                      padding: '1rem',
                      fontSize: '0.9rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#5865F2',
                            textDecoration: 'none',
                            wordBreak: 'break-all'
                          }}
                        >
                          {file.filename}
                        </a>
                      </div>
                    </td>
                    <td style={{
                      padding: '1rem',
                      fontSize: '0.875rem',
                      color: '#666666'
                    }}>
                      {formatFileSize(file.size)}
                    </td>
                    <td style={{
                      padding: '1rem',
                      fontSize: '0.875rem',
                      color: '#666666'
                    }}>
                      {formatTimestamp(file.timestamp)}
                    </td>
                    <td style={{
                      padding: '1rem',
                      fontSize: '0.875rem',
                      color: '#666666',
                      fontFamily: 'monospace'
                    }}>
                      {file.ip || 'Unknown'}
                    </td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => copyToClipboard(file.url)}
                          title="Copy URL"
                          style={{
                            padding: '0.45rem 0.7rem',
                            background: '#111111',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: '#f5f5f5',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontFamily: "'Open Sans', sans-serif"
                          }}
                        >
                          📋
                        </button>
                        <button
                          onClick={() => deleteFile(file.url, file.filename)}
                          disabled={deleting === file.url}
                          style={{
                            padding: '0.45rem 0.7rem',
                            background: '#111111',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: '#f5f5f5',
                            fontSize: '0.8rem',
                            cursor: deleting === file.url ? 'not-allowed' : 'pointer',
                            opacity: deleting === file.url ? 0.5 : 1,
                            fontFamily: "'Open Sans', sans-serif"
                          }}
                        >
                          {deleting === file.url ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
