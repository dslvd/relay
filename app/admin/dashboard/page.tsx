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

type SortKey = 'filename' | 'size' | 'timestamp' | 'ip';
type SortOrder = 'asc' | 'desc';

export default function AdminDashboard() {
  const [files, setFiles] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const isAuth = sessionStorage.getItem('admin_authenticated');
    if (!isAuth) {
      router.push('/admin');
      return;
    }

    fetchFiles();
  }, [router]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/history', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.history || []);
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
