'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  size: number;
  ip?: string;
  quarantined?: boolean;
  quarantineReason?: string | null;
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

interface PremiumInvite {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  usedByUserId?: string;
}

interface PremiumUser {
  id: string;
  email: string;
  createdAt: number;
  lastLoginAt?: number;
}

interface StorageStats {
  storage: {
    bytes: number;
    objects: number;
    updatedAt: number;
  };
  bandwidth: {
    bytes24h: number;
    bytes7days: number;
  };
  cost: {
    storageMonthly: number;
    storageWeekly: number;
    storageDaily: number;
    bandwidth24h: number;
    bandwidth7days: number;
    pricing: {
      storagePerGbMonth: number;
      egressPerGb: number;
    };
  };
  cached: boolean;
}

interface BlacklistRule {
  id: string;
  type: 'ip' | 'filename';
  pattern: string;
  createdAt: number;
}

interface QuarantineRecord {
  objectKey: string;
  reason?: string;
  createdAt: number;
  createdByIp?: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  actorIp?: string;
  userAgent?: string;
  target?: string;
  meta?: Record<string, unknown>;
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
  const [premiumInvites, setPremiumInvites] = useState<PremiumInvite[]>([]);
  const [premiumUsers, setPremiumUsers] = useState<PremiumUser[]>([]);
  const [inviteTtlHours, setInviteTtlHours] = useState(24);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [deletingSilent, setDeletingSilent] = useState<Set<string>>(new Set());
  const [deleteFeedback, setDeleteFeedback] = useState<Record<string, 'ok' | 'err'>>({});
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [blacklistRules, setBlacklistRules] = useState<BlacklistRule[]>([]);
  const [quarantineRecords, setQuarantineRecords] = useState<QuarantineRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [blacklistType, setBlacklistType] = useState<'ip' | 'filename'>('ip');
  const [blacklistPattern, setBlacklistPattern] = useState('');
  const [addingRule, setAddingRule] = useState(false);
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
      const [filesResponse, analyticsResponse, premiumResponse, statsResponse, abuseResponse, auditResponse] = await Promise.all([
        fetch('/api/admin/files', { cache: 'no-store' }),
        fetch('/api/analytics', { cache: 'no-store' }),
        fetch('/api/admin/premium', { cache: 'no-store' }),
        fetch('/api/admin/stats', { cache: 'no-store' }),
        fetch('/api/admin/abuse', { cache: 'no-store' }),
        fetch('/api/admin/audit?limit=200', { cache: 'no-store' }),
      ]);

      const responses = [filesResponse, analyticsResponse, premiumResponse, statsResponse, abuseResponse, auditResponse];
      if (responses.some((res) => res.status === 401)) {
        sessionStorage.removeItem('admin_authenticated');
        router.push('/admin');
        return;
      }

      if (filesResponse.ok) {
        const data = await filesResponse.json();
        setFiles(data.history || []);
      }

      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json();
        setAnalytics(data);
      }

      if (premiumResponse.ok) {
        const data = await premiumResponse.json();
        setPremiumInvites(data.invites || []);
        setPremiumUsers(data.users || []);
      }

      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStorageStats(data as StorageStats);
      }

      if (abuseResponse.ok) {
        const data = await abuseResponse.json();
        setBlacklistRules(data.blacklist || []);
        setQuarantineRecords(data.quarantine || []);
      }

      if (auditResponse.ok) {
        const data = await auditResponse.json();
        setAuditLog(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPremiumInvite = async () => {
    try {
      setCreatingInvite(true);
      const response = await fetch('/api/admin/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_invite', ttlHours: inviteTtlHours })
      });

      if (!response.ok) {
        alert('Failed to create premium invite');
        return;
      }

      await fetchFiles();
      alert('Premium invite created');
    } catch (error) {
      console.error('Failed to create premium invite:', error);
      alert('Failed to create premium invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const deletePremiumInvite = async (inviteId: string) => {
    try {
      const response = await fetch('/api/admin/premium', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'invite', id: inviteId })
      });

      if (response.ok) {
        await fetchFiles();
      } else {
        alert('Failed to delete invite');
      }
    } catch (error) {
      console.error('Failed to delete invite:', error);
      alert('Failed to delete invite');
    }
  };

  const deletePremiumUser = async (userId: string, email: string) => {
    if (!confirm(`Delete premium user ${email}?`)) return;

    try {
      const response = await fetch('/api/admin/premium', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', id: userId })
      });

      if (response.ok) {
        await fetchFiles();
      } else {
        alert('Failed to delete premium user');
      }
    } catch (error) {
      console.error('Failed to delete premium user:', error);
      alert('Failed to delete premium user');
    }
  };

  // Direct delete used by File Manager — no confirm dialog, instant local state update
  const deleteFileDirect = async (url: string) => {
    setDeletingSilent(prev => { const n = new Set(prev); n.add(url); return n; });
    try {
      const response = await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (response.ok) {
        setFiles(current => current.filter(f => f.url !== url));
        setSelectedFiles(current => { const n = new Set(current); n.delete(url); return n; });
        setDeleteFeedback(prev => ({ ...prev, [url]: 'ok' }));
        window.setTimeout(() => setDeleteFeedback(prev => { const n = { ...prev }; delete n[url]; return n; }), 1500);
      } else {
        setDeleteFeedback(prev => ({ ...prev, [url]: 'err' }));
        window.setTimeout(() => setDeleteFeedback(prev => { const n = { ...prev }; delete n[url]; return n; }), 3000);
      }
    } catch {
      setDeleteFeedback(prev => ({ ...prev, [url]: 'err' }));
      window.setTimeout(() => setDeleteFeedback(prev => { const n = { ...prev }; delete n[url]; return n; }), 3000);
    } finally {
      setDeletingSilent(prev => { const n = new Set(prev); n.delete(url); return n; });
    }
  };

  const deleteSelectedDirect = async () => {
    if (selectedFiles.size === 0) return;
    if (!confirm(`Permanently delete ${selectedFiles.size} file(s) from Cloudflare R2? This cannot be undone.`)) return;
    const urls = Array.from(selectedFiles);
    urls.forEach(url => setDeletingSilent(prev => { const n = new Set(prev); n.add(url); return n; }));
    await Promise.all(urls.map(async url => {
      try {
        const res = await fetch('/api/admin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        if (res.ok) {
          setFiles(current => current.filter(f => f.url !== url));
        }
      } catch { /* continue */ } finally {
        setDeletingSilent(prev => { const n = new Set(prev); n.delete(url); return n; });
      }
    }));
    setSelectedFiles(new Set());
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

  const formatCurrency = (value: number) => {
    return `$${Math.round(value * 100) / 100}`;
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

  const runBulkAction = async (action: 'delete' | 'expire' | 'quarantine' | 'unquarantine', urls?: string[]) => {
    const targets = urls || Array.from(selectedFiles);
    if (targets.length === 0) return;

    if (action === 'delete' && !confirm(`Delete ${targets.length} file(s)? This cannot be undone.`)) {
      return;
    }

    if (action === 'expire' && !confirm(`Expire ${targets.length} file(s)? They will be removed permanently.`)) {
      return;
    }

    let reason = '';
    if (action === 'quarantine') {
      reason = prompt('Reason for quarantine (optional):') || '';
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, urls: targets, reason }),
      });

      if (!response.ok) {
        alert('Bulk action failed');
        return;
      }

      setSelectedFiles(new Set());
      await fetchFiles();
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Bulk action failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleQuarantine = async (file: UploadRecord) => {
    const action = file.quarantined ? 'unquarantine' : 'quarantine';
    await runBulkAction(action, [file.url]);
  };

  const addBlacklistRule = async (patternOverride?: string, typeOverride?: 'ip' | 'filename') => {
    const pattern = (patternOverride ?? blacklistPattern).trim();
    const type = typeOverride ?? blacklistType;
    if (!pattern) return;

    try {
      setAddingRule(true);
      const response = await fetch('/api/admin/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, pattern }),
      });

      if (!response.ok) {
        alert('Failed to add rule');
        return;
      }

      setBlacklistPattern('');
      await fetchFiles();
    } catch (error) {
      console.error('Failed to add blacklist rule:', error);
      alert('Failed to add rule');
    } finally {
      setAddingRule(false);
    }
  };

  const removeBlacklistRuleById = async (id: string) => {
    try {
      const response = await fetch('/api/admin/abuse', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        alert('Failed to remove rule');
        return;
      }

      await fetchFiles();
    } catch (error) {
      console.error('Failed to remove blacklist rule:', error);
    }
  };

  const blacklistIpFromFile = async (ip?: string) => {
    if (!ip) return;
    setBlacklistType('ip');
    await addBlacklistRule(ip, 'ip');
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
      background: 'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
      backgroundAttachment: 'fixed',
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
            <a
              href="/admin/analytics"
              style={{
                padding: '0.625rem 1.25rem',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '999px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="Open detailed analytics"
            >
              📈 Analytics
            </a>
            <button
              onClick={fetchFiles}
              disabled={loading}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '999px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Open Sans', sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>

            <button
              onClick={logout}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'rgba(233,236,242,0.15)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(233,236,242,0.35)',
                borderRadius: '999px',
                color: '#eef1f6',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Premium Access Manager */}
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
            ⭐ Manage Premium Access 
          </h3>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#666666' }}>Invite TTL (hours)</label>
            <input
              type="number"
              min={1}
              value={inviteTtlHours}
              onChange={(e) => setInviteTtlHours(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: '110px',
                padding: '0.45rem 0.6rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                color: '#f5f5f5',
                fontSize: '0.85rem'
              }}
            />
            <button
              onClick={createPremiumInvite}
              disabled={creatingInvite}
              style={{
                padding: '0.55rem 1rem',
                background: 'rgba(233,236,242,0.15)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(233,236,242,0.35)',
                borderRadius: '999px',
                color: '#eef1f6',
                fontSize: '0.85rem',
                cursor: creatingInvite ? 'not-allowed' : 'pointer',
                fontFamily: "'Open Sans', sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              {creatingInvite ? 'Creating...' : 'Generate premium signup link'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: '#f5f5f5', marginBottom: '0.75rem' }}>Signup Links ({premiumInvites.length})</div>
              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {premiumInvites.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#666666' }}>No premium invites yet</div>
                )}
                {premiumInvites.map((invite) => {
                  const inviteLink = `${window.location.origin}/premium?invite=${invite.token}`;
                  const isExpired = invite.expiresAt <= Date.now();
                  const isUsed = Boolean(invite.usedAt);

                  return (
                    <div key={invite.id} style={{
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '0.65rem'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginBottom: '0.45rem' }}>
                        {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'} • Expires {new Date(invite.expiresAt).toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => copyToClipboard(inviteLink)}
                          style={{
                            padding: '0.4rem 0.65rem',
                            background: 'rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '8px',
                            color: '#f5f5f5',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}
                        >
                          Copy link
                        </button>
                        <button
                          onClick={() => deletePremiumInvite(invite.id)}
                          style={{
                            padding: '0.4rem 0.65rem',
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: '#f5f5f5',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: '#f5f5f5', marginBottom: '0.75rem' }}>Premium Accounts ({premiumUsers.length})</div>
              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {premiumUsers.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#666666' }}>No premium users yet</div>
                )}
                {premiumUsers.map((user) => (
                  <div key={user.id} style={{
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0.65rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#f5f5f5' }}>{user.email}</div>
                      <div style={{ fontSize: '0.72rem', color: '#8a8a8a' }}>
                        Created {new Date(user.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePremiumUser(user.id, user.email)}
                      style={{
                        padding: '0.38rem 0.62rem',
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: '#f5f5f5',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {formatFileSize(storageStats?.storage.bytes ?? totalSize)}
            </div>
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

        {storageStats && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 300, color: '#f5f5f5', margin: 0 }}>
                💸 Storage usage + cost estimates
              </h3>
              <div style={{ fontSize: '0.72rem', color: '#666666' }}>
                Updated {formatTimeAgo(storageStats.storage.updatedAt)} {storageStats.cached ? '• cached' : ''}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.4rem' }}>Storage (current)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatFileSize(storageStats.storage.bytes)}</div>
                <div style={{ fontSize: '0.7rem', color: '#666666' }}>{storageStats.storage.objects} objects</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.4rem' }}>Est. storage cost / mo</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(storageStats.cost.storageMonthly)}</div>
                <div style={{ fontSize: '0.7rem', color: '#666666' }}>${storageStats.cost.pricing.storagePerGbMonth}/GB-mo</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.4rem' }}>Bandwidth cost (24h)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(storageStats.cost.bandwidth24h)}</div>
                <div style={{ fontSize: '0.7rem', color: '#666666' }}>{formatFileSize(storageStats.bandwidth.bytes24h)}</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.4rem' }}>Bandwidth cost (7d)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(storageStats.cost.bandwidth7days)}</div>
                <div style={{ fontSize: '0.7rem', color: '#666666' }}>{formatFileSize(storageStats.bandwidth.bytes7days)}</div>
              </div>
            </div>
          </div>
        )}

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
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              📥 Export JSON
            </button>

            <button
              onClick={() => exportData('csv')}
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: "'Open Sans', sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
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
                  background: 'rgba(180,50,50,0.2)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(220,80,80,0.35)',
                  borderRadius: '10px',
                  color: '#f5a5a5',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif",
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                🗑️ Delete Selected
              </button>
              <button
                onClick={() => runBulkAction('expire')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(255,200,100,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,200,100,0.35)',
                  borderRadius: '10px',
                  color: '#ffd1a3',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif",
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                ⏳ Expire Selected
              </button>
              <button
                onClick={() => runBulkAction('quarantine')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(200, 60, 60, 0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 120, 120, 0.45)',
                  borderRadius: '10px',
                  color: '#f2bcbc',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif",
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                🧪 Quarantine Selected
              </button>
              <button
                onClick={() => runBulkAction('unquarantine')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  color: '#c3cad6',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif",
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                ✅ Unquarantine
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
            background: 'rgba(180,50,50,0.2)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(220,80,80,0.35)',
            borderRadius: '999px',
            color: '#f5a5a5',
              fontSize: '0.875rem',
            fontWeight: 400,
            letterSpacing: '0.02em',
              cursor: loading || files.length === 0 ? 'not-allowed' : 'pointer',
              opacity: loading || files.length === 0 ? 0.5 : 1,
              fontFamily: "'Open Sans', sans-serif",
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}
          >
            🗑️ Delete All Files
          </button>
        </div>

        {/* Abuse + Blacklist */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 300, marginBottom: '0.9rem', color: '#f5f5f5' }}>
            🚫 Abuse flags + blacklist
          </h3>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <select
              value={blacklistType}
              onChange={(e) => setBlacklistType(e.target.value as 'ip' | 'filename')}
              style={{
                padding: '0.55rem 0.75rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="ip">IP pattern</option>
              <option value="filename">Filename pattern</option>
            </select>
            <input
              value={blacklistPattern}
              onChange={(e) => setBlacklistPattern(e.target.value)}
              placeholder={blacklistType === 'ip' ? 'e.g. ^192\\.168\\.' : 'e.g. .*\.exe$'}
              style={{
                flex: '1 1 280px',
                padding: '0.55rem 0.75rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                color: '#f5f5f5',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
            <button
              onClick={() => void addBlacklistRule()}
              disabled={addingRule}
              style={{
                padding: '0.55rem 1rem',
                background: 'rgba(233,236,242,0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(233,236,242,0.35)',
                borderRadius: '999px',
                color: '#eef1f6',
                fontSize: '0.82rem',
                cursor: addingRule ? 'not-allowed' : 'pointer',
                fontFamily: "'Open Sans', sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              {addingRule ? 'Adding...' : 'Add rule'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: '#f5f5f5', marginBottom: '0.75rem' }}>
                Blacklist rules ({blacklistRules.length})
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {blacklistRules.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#666666' }}>No rules yet</div>
                )}
                {blacklistRules.map((rule) => (
                  <div key={rule.id} style={{
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0.65rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', color: '#f5f5f5' }}>{rule.pattern}</div>
                      <div style={{ fontSize: '0.7rem', color: '#8a8a8a' }}>{rule.type} • {new Date(rule.createdAt).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => removeBlacklistRuleById(rule.id)}
                      style={{
                        padding: '0.35rem 0.6rem',
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: '#f5f5f5',
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: '#f5f5f5', marginBottom: '0.75rem' }}>
                Quarantined files ({quarantineRecords.length})
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {quarantineRecords.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#666666' }}>No quarantined files</div>
                )}
                {quarantineRecords.slice(0, 25).map((record) => (
                  <div key={record.objectKey} style={{
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0.65rem'
                  }}>
                    <div style={{ fontSize: '0.78rem', color: '#f5f5f5', wordBreak: 'break-all' }}>{record.objectKey}</div>
                    <div style={{ fontSize: '0.7rem', color: '#8a8a8a' }}>{record.reason || 'No reason'} • {new Date(record.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Audit Log */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 300, marginBottom: '0.9rem', color: '#f5f5f5' }}>
            🧾 Admin audit log
          </h3>
          <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
            {auditLog.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: '#666666' }}>No recent activity</div>
            )}
            {auditLog.map((entry) => (
              <div key={entry.id} style={{
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '0.65rem'
              }}>
                <div style={{ fontSize: '0.78rem', color: '#f5f5f5' }}>{entry.action}</div>
                <div style={{ fontSize: '0.7rem', color: '#8a8a8a' }}>
                  {new Date(entry.timestamp).toLocaleString()} • {entry.actorIp || 'unknown'}
                  {entry.target ? ` • ${entry.target}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File Manager — dedicated delete panel */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 400, color: '#f5f5f5', marginBottom: '0.35rem', fontFamily: "'Open Sans', sans-serif" }}>
                🗂️ File Manager
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#666666', margin: 0, lineHeight: 1.5 }}>
                Select files below and delete them — this <strong style={{ color: '#a0a0a0' }}>permanently removes them from Cloudflare R2</strong> and invalidates their public URL immediately.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {files.length > 0 && (
                <button
                  onClick={() =>
                    selectedFiles.size === filteredFiles.length
                      ? setSelectedFiles(new Set())
                      : setSelectedFiles(new Set(filteredFiles.map(f => f.url)))
                  }
                  style={{
                    padding: '0.45rem 0.9rem',
                    background: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '999px',
                    color: '#c3cad6',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontFamily: "'Open Sans', sans-serif"
                  }}
                >
                  {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? 'Deselect All' : `Select All (${filteredFiles.length})`}
                </button>
              )}
              {selectedFiles.size > 0 && (
                <>
                  <span style={{ color: '#8a92a1', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {selectedFiles.size} selected
                  </span>
                  <button
                    onClick={deleteSelectedDirect}
                    disabled={deletingSilent.size > 0}
                    style={{
                      padding: '0.45rem 1rem',
                      background: 'rgba(180,50,50,0.25)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(220,80,80,0.4)',
                      borderRadius: '999px',
                      color: '#f5a5a5',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: deletingSilent.size > 0 ? 'not-allowed' : 'pointer',
                      opacity: deletingSilent.size > 0 ? 0.6 : 1,
                      fontFamily: "'Open Sans', sans-serif",
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🗑️ Delete {selectedFiles.size} from R2
                  </button>
                  <button
                    onClick={() => setSelectedFiles(new Set())}
                    style={{
                      padding: '0.45rem 0.8rem',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '999px',
                      color: '#8a92a1',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      fontFamily: "'Open Sans', sans-serif"
                    }}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* File list */}
          {loading ? (
            <div style={{ color: '#666666', fontSize: '0.875rem', padding: '1rem 0' }}>Loading files...</div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ color: '#666666', fontSize: '0.875rem', padding: '1rem 0' }}>No files found. {searchQuery && 'Try clearing the search filter.'}</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '440px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredFiles.map(file => {
                const isDeleting = deletingSilent.has(file.url);
                const feedback = deleteFeedback[file.url];
                const isSelected = selectedFiles.has(file.url);
                return (
                  <div
                    key={file.url}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.7rem 0.9rem',
                      borderRadius: '12px',
                      background: isSelected ? 'rgba(233,236,242,0.07)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectFile(file.url)}
                      style={{ accentColor: '#e9ecf2', width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#f5f5f5', wordBreak: 'break-all', lineHeight: 1.35 }}>
                        {file.filename}
                      </div>
                      {file.quarantined && (
                        <div style={{
                          marginTop: '0.25rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          border: '1px solid rgba(255, 120, 120, 0.45)',
                          background: 'rgba(200, 60, 60, 0.18)',
                          color: '#f2bcbc',
                          fontSize: '0.68rem',
                          letterSpacing: '0.04em'
                        }}>
                          Quarantined
                        </div>
                      )}
                      <div style={{ fontSize: '0.72rem', color: '#666666', marginTop: '0.2rem' }}>
                        {formatFileSize(file.size)} &bull; {formatTimestamp(file.timestamp)}{file.ip ? ` · ${file.ip}` : ''}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {feedback === 'ok' && (
                        <span style={{ fontSize: '0.75rem', color: '#4ff8c0' }}>✓ Deleted</span>
                      )}
                      {feedback === 'err' && (
                        <span style={{ fontSize: '0.75rem', color: '#f5a5a5' }}>✗ Failed</span>
                      )}
                      <button
                        onClick={() => deleteFileDirect(file.url)}
                        disabled={isDeleting}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          background: isDeleting ? 'rgba(255,255,255,0.04)' : 'rgba(180,50,50,0.2)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: isDeleting ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(220,80,80,0.35)',
                          color: isDeleting ? '#8a92a1' : '#f5a5a5',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          fontFamily: "'Open Sans', sans-serif",
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isDeleting ? 'Deleting...' : '🗑️ Delete'}
                      </button>
                      <button
                        onClick={() => toggleQuarantine(file)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          background: file.quarantined ? 'rgba(255,255,255,0.05)' : 'rgba(255,200,100,0.18)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: file.quarantined ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,200,100,0.35)',
                          color: file.quarantined ? '#8a92a1' : '#ffd1a3',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: "'Open Sans', sans-serif",
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {file.quarantined ? 'Unquarantine' : 'Quarantine'}
                      </button>
                      {file.ip && (
                        <button
                          onClick={() => blacklistIpFromFile(file.ip)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#d0d6e0',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            fontFamily: "'Open Sans', sans-serif",
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Block IP
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                        {file.quarantined && (
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            border: '1px solid rgba(255, 120, 120, 0.45)',
                            background: 'rgba(200, 60, 60, 0.18)',
                            color: '#f2bcbc',
                            fontSize: '0.65rem',
                            letterSpacing: '0.04em'
                          }}>
                            Quarantined
                          </span>
                        )}
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
                            background: 'rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '8px',
                            color: '#f5f5f5',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontFamily: "'Open Sans', sans-serif",
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}
                        >
                          📋
                        </button>
                        <button
                          onClick={() => toggleQuarantine(file)}
                          title={file.quarantined ? 'Unquarantine' : 'Quarantine'}
                          style={{
                            padding: '0.45rem 0.7rem',
                            background: file.quarantined ? 'rgba(255,255,255,0.05)' : 'rgba(255,200,100,0.18)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: file.quarantined ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,200,100,0.35)',
                            borderRadius: '8px',
                            color: file.quarantined ? '#8a92a1' : '#ffd1a3',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontFamily: "'Open Sans', sans-serif",
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}
                        >
                          {file.quarantined ? '✅' : '🧪'}
                        </button>
                        {file.ip && (
                          <button
                            onClick={() => blacklistIpFromFile(file.ip)}
                            title="Blacklist IP"
                            style={{
                              padding: '0.45rem 0.7rem',
                              background: 'rgba(255,255,255,0.05)',
                              backdropFilter: 'blur(10px)',
                              WebkitBackdropFilter: 'blur(10px)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              color: '#c3cad6',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontFamily: "'Open Sans', sans-serif",
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                            }}
                          >
                            🚫
                          </button>
                        )}
                        <button
                          onClick={() => deleteFile(file.url, file.filename)}
                          disabled={deleting === file.url}
                          style={{
                            padding: '0.45rem 0.7rem',
                            background: deleting === file.url ? 'rgba(255,255,255,0.05)' : 'rgba(180,50,50,0.18)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: deleting === file.url ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(220,80,80,0.3)',
                            borderRadius: '8px',
                            color: deleting === file.url ? '#8a92a1' : '#f5a5a5',
                            fontSize: '0.8rem',
                            cursor: deleting === file.url ? 'not-allowed' : 'pointer',
                            opacity: deleting === file.url ? 0.5 : 1,
                            fontFamily: "'Open Sans', sans-serif",
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
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
