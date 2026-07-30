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
  lastAccessTime?: number;
  expiresAt?: number;
  folder?: string;
  tags?: string[];
  favorite?: boolean;
  displayName?: string;
  updatedAt?: number | null;
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

interface PlusInvite {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  usedByUserId?: string;
}

interface PlusUser {
  id: string;
  email: string;
  createdAt: number;
  lastLoginAt?: number;
  planStatus?: 'active' | 'canceled' | 'past_due';
  isPaidSubscriber?: boolean;
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

interface AbuseReport {
  id: string;
  timestamp: number;
  url: string;
  category: string;
  description: string;
  reporterEmail?: string;
  reporterIp?: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolvedAt?: number;
  resolvedAction?: 'disabled' | 'deleted' | 'dismissed' | 'reopened';
  resolvedByIp?: string;
}

interface R2File {
  key: string;
  size: number;
  lastModified: number | null;
  filename: string | null;
  url: string | null;
  ip: string | null;
  scope: 'public' | 'plus' | null;
  tracked: boolean;
  quarantined: boolean;
  quarantineReason: string | null;
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

type SortKey = 'filename' | 'size' | 'timestamp' | 'ip' | 'folder' | 'favorite' | 'tags' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export default function AdminDashboard() {
  const [files, setFiles] = useState<UploadRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [favoriteFilter, setFavoriteFilter] = useState<'all' | 'favorites' | 'unstarred'>('all');
  const [bulkMoveFolder, setBulkMoveFolder] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [plusInvites, setPlusInvites] = useState<PlusInvite[]>([]);
  const [plusUsers, setPlusUsers] = useState<PlusUser[]>([]);
  const [inviteTtlHours, setInviteTtlHours] = useState(24);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [deletingSilent, setDeletingSilent] = useState<Set<string>>(new Set());
  const [deleteFeedback, setDeleteFeedback] = useState<Record<string, 'ok' | 'err'>>({});
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [blacklistRules, setBlacklistRules] = useState<BlacklistRule[]>([]);
  const [quarantineRecords, setQuarantineRecords] = useState<QuarantineRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [reports, setReports] = useState<AbuseReport[]>([]);
  const [reportActionId, setReportActionId] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'open' | 'resolved' | 'dismissed' | 'all'>('open');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [r2Files, setR2Files] = useState<R2File[]>([]);
  const [r2Cursor, setR2Cursor] = useState<string | null>(null);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Loaded, setR2Loaded] = useState(false);
  const [r2Prefix, setR2Prefix] = useState('');
  const [r2ActionKey, setR2ActionKey] = useState<string | null>(null);
  const [blacklistType, setBlacklistType] = useState<'ip' | 'filename'>('ip');
  const [blacklistPattern, setBlacklistPattern] = useState('');
  const [addingRule, setAddingRule] = useState(false);
  const [organizingFiles, setOrganizingFiles] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchFiles();
    
    // Auto-refresh analytics every 30 seconds
    const interval = setInterval(() => {
      fetchFiles();
    }, 30000);
    
    return () => clearInterval(interval);
  // fetchFiles is intentionally not in deps to avoid recreating the polling loop on state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const [filesResponse, analyticsResponse, plusResponse, statsResponse, abuseResponse, auditResponse, reportsResponse] = await Promise.all([
        fetch('/api/admin/files', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/analytics', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/plus', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/stats', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/abuse', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/audit?limit=200', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/reports', { cache: 'no-store', credentials: 'include' }),
      ]);

      const responses = [filesResponse, analyticsResponse, plusResponse, statsResponse, abuseResponse, auditResponse, reportsResponse];
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

      if (plusResponse.ok) {
        const data = await plusResponse.json();
        setPlusInvites(data.invites || []);
        setPlusUsers(data.users || []);
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

      if (reportsResponse.ok) {
        const data = await reportsResponse.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPlusInvite = async () => {
    try {
      setCreatingInvite(true);
      const response = await fetch('/api/admin/plus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'create_invite', ttlHours: inviteTtlHours })
      });

      if (!response.ok) {
        alert('Failed to create Plus invite');
        return;
      }

      await fetchFiles();
      alert('Plus invite created');
    } catch (error) {
      console.error('Failed to create Plus invite:', error);
      alert('Failed to create Plus invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const deletePlusInvite = async (inviteId: string) => {
    try {
      const response = await fetch('/api/admin/plus', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  const deletePlusUser = async (userId: string, email: string) => {
    if (!confirm(`Delete plus user ${email}?`)) return;

    try {
      const response = await fetch('/api/admin/plus', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'user', id: userId })
      });

      if (response.ok) {
        await fetchFiles();
      } else {
        alert('Failed to delete Plus user');
      }
    } catch (error) {
      console.error('Failed to delete Plus user:', error);
      alert('Failed to delete Plus user');
    }
  };

  // Direct delete used by File Manager — no confirm dialog, instant local state update
  const deleteFileDirect = async (url: string) => {
    setDeletingSilent(prev => { const n = new Set(prev); n.add(url); return n; });
    try {
      const response = await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        credentials: 'include',
        body: JSON.stringify({ url })
      })
        if (res.ok) {
          setFiles(current => current.filter(f => f.url !== url));
        }
      } catch { /* continue */ } finally {
        setDeletingSilent(prev => { const n = new Set(prev); n.delete(url); return n; });
      }
    }));
    setSelectedFiles(new Set());
  };


  const logout = () => {
    fetch('/api/admin/auth', { method: 'DELETE', credentials: 'include' }).finally(() => {
      sessionStorage.removeItem('admin_authenticated');
      router.push('/admin');
    });
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

  const normalizeTags = (value: string) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );

  const getFileDisplayName = (file: UploadRecord) => file.displayName || file.filename;

  const getFileFolder = (file: UploadRecord) => file.folder?.trim() || 'Unsorted';

  const formatTags = (tags?: string[]) => (tags && tags.length ? tags.join(', ') : 'No tags');

  const updateFileMetadata = async (payload: {
    urls: string[];
    filename?: string;
    folder?: string;
    tags?: string[];
    favorite?: boolean;
    displayName?: string;
  }) => {
    setOrganizingFiles(true);
    try {
      const response = await fetch('/api/admin/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update file metadata');
      }

      await fetchFiles();
    } catch (error) {
      console.error('Failed to update file metadata:', error);
      alert(error instanceof Error ? error.message : 'Failed to update file metadata');
    } finally {
      setOrganizingFiles(false);
    }
  };

  const renameFile = async (file: UploadRecord) => {
    const nextName = window.prompt('Rename file', getFileDisplayName(file));
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;

    await updateFileMetadata({ urls: [file.url], filename: trimmed, displayName: trimmed });
  };

  const moveFile = async (file: UploadRecord) => {
    const nextFolder = window.prompt('Move file to folder', file.folder || '');
    if (nextFolder === null) return;

    await updateFileMetadata({ urls: [file.url], folder: nextFolder.trim() });
    setFolderFilter('all');
  };

  const editTags = async (file: UploadRecord) => {
    const nextTags = window.prompt('Tags for this file, comma separated', formatTags(file.tags));
    if (nextTags === null) return;

    await updateFileMetadata({ urls: [file.url], tags: normalizeTags(nextTags) });
  };

  const toggleFavoriteFile = async (file: UploadRecord) => {
    await updateFileMetadata({ urls: [file.url], favorite: !file.favorite });
  };

  const applyBulkMove = async () => {
    const urls = Array.from(selectedFiles);
    if (urls.length === 0) return;
    const folder = bulkMoveFolder.trim();
    if (!folder) return;

    await updateFileMetadata({ urls, folder });
    setBulkMoveFolder('');
    setSelectedFiles(new Set());
  };

  const applyBulkTags = async () => {
    const urls = Array.from(selectedFiles);
    if (urls.length === 0) return;

    await updateFileMetadata({ urls, tags: normalizeTags(bulkTags) });
    setBulkTags('');
    setSelectedFiles(new Set());
  };

  const runCleanup = async () => {
    try {
      setRunningCleanup(true);
      const response = await fetch('/api/cleanup', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        alert('Cleanup failed');
        return;
      }

      await fetchFiles();
      alert('Cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
      alert('Cleanup failed');
    } finally {
      setRunningCleanup(false);
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


  const runBulkAction = async (
    action: 'delete' | 'expire' | 'quarantine' | 'unquarantine',
    urls?: string[],
    options?: { skipPrompts?: boolean; reason?: string }
  ): Promise<boolean> => {
    const targets = urls || Array.from(selectedFiles);
    if (targets.length === 0) return false;

    if (!options?.skipPrompts) {
      if (action === 'delete' && !confirm(`Delete ${targets.length} file(s)? This cannot be undone.`)) {
        return false;
      }

      if (action === 'expire' && !confirm(`Expire ${targets.length} file(s)? They will be removed permanently.`)) {
        return false;
      }
    }

    let reason = options?.reason ?? '';
    if (action === 'quarantine' && !options?.skipPrompts) {
      reason = prompt('Reason for quarantine (optional):') || '';
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, urls: targets, reason }),
      });

      if (!response.ok) {
        alert('Bulk action failed');
        return false;
      }

      setSelectedFiles(new Set());
      await fetchFiles();
      return true;
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Bulk action failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatusById = async (
    id: string,
    status: 'open' | 'resolved' | 'dismissed',
    action?: 'disabled' | 'deleted' | 'dismissed' | 'reopened'
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status, action }),
      });
      if (!response.ok) {
        alert('Failed to update report');
        return false;
      }
      setReports((prev) => prev.map((r) => (r.id === id ? {
        ...r,
        status,
        resolvedAt: status === 'open' ? undefined : Date.now(),
        resolvedAction: status === 'open' ? undefined : action,
      } : r)));
      return true;
    } catch (error) {
      console.error('Failed to update report status:', error);
      alert('Failed to update report');
      return false;
    }
  };

  // Disable/Delete act on the reported URL via the existing bulk-action
  // endpoint (same code path as the file manager's own quarantine/delete
  // buttons) - the report is then marked resolved only if the file action
  // actually succeeded, so a failed R2 call never silently hides a report.
  const disableReportedLink = async (report: AbuseReport) => {
    if (!confirm(`Disable this link?\n\n${report.url}\n\nThe file stays in storage but will no longer be servable.`)) return;
    setReportActionId(report.id);
    try {
      const ok = await runBulkAction('quarantine', [report.url], { skipPrompts: true, reason: `Reported: ${report.category}` });
      if (ok) await updateReportStatusById(report.id, 'resolved', 'disabled');
    } finally {
      setReportActionId(null);
    }
  };

  const deleteReportedFile = async (report: AbuseReport) => {
    if (!confirm(`Permanently delete this file?\n\n${report.url}\n\nThis cannot be undone.`)) return;
    setReportActionId(report.id);
    try {
      const ok = await runBulkAction('delete', [report.url], { skipPrompts: true });
      if (ok) await updateReportStatusById(report.id, 'resolved', 'deleted');
    } finally {
      setReportActionId(null);
    }
  };

  const dismissReport = async (report: AbuseReport) => {
    setReportActionId(report.id);
    try {
      await updateReportStatusById(report.id, 'dismissed', 'dismissed');
    } finally {
      setReportActionId(null);
    }
  };

  const reopenReport = async (report: AbuseReport) => {
    setReportActionId(report.id);
    try {
      await updateReportStatusById(report.id, 'open', 'reopened');
    } finally {
      setReportActionId(null);
    }
  };

  // R2 file manager - browses the bucket directly (paginated) rather than
  // the upload-history table, so objects that lost their history record (or
  // never had one) still show up. Lazy-loaded on demand since listing R2 is
  // a real network call, not worth doing on every dashboard page load.
  const loadR2Files = async (reset: boolean) => {
    setR2Loading(true);
    try {
      const params = new URLSearchParams();
      if (r2Prefix.trim()) params.set('prefix', r2Prefix.trim());
      if (!reset && r2Cursor) params.set('cursor', r2Cursor);

      const response = await fetch(`/api/admin/r2-files?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) {
        alert('Failed to list R2 files');
        return;
      }
      const data = await response.json();
      setR2Files((prev) => (reset ? data.files : [...prev, ...data.files]));
      setR2Cursor(data.nextCursor);
      setR2Loaded(true);
    } catch (error) {
      console.error('Failed to list R2 files:', error);
      alert('Failed to list R2 files');
    } finally {
      setR2Loading(false);
    }
  };

  const r2FileAction = async (file: R2File, action: 'delete' | 'quarantine' | 'unquarantine') => {
    if (action === 'delete' && !confirm(`Permanently delete this object?\n\n${file.key}\n\nThis cannot be undone.`)) return;
    setR2ActionKey(file.key);
    try {
      const reason = action === 'quarantine' ? (prompt('Reason for quarantine (optional):') || '') : '';
      const response = await fetch('/api/admin/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, keys: [file.key], reason }),
      });
      if (!response.ok) {
        alert('Action failed');
        return;
      }
      if (action === 'delete') {
        setR2Files((prev) => prev.filter((f) => f.key !== file.key));
      } else {
        setR2Files((prev) => prev.map((f) => (f.key === file.key ? { ...f, quarantined: action === 'quarantine' } : f)));
      }
    } catch (error) {
      console.error('R2 file action failed:', error);
      alert('Action failed');
    } finally {
      setR2ActionKey(null);
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
        credentials: 'include',
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
        credentials: 'include',
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

  const folderOptions = Array.from(new Set(files.map((file) => file.folder?.trim()).filter((folder): folder is string => Boolean(folder)))).sort();

  const filteredFiles = files.filter(file => {
    const searchTarget = [
      file.filename,
      file.displayName,
      file.url,
      file.ip,
      file.folder,
      ...(file.tags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = searchQuery.trim() === '' || searchTarget.includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (folderFilter !== 'all' && getFileFolder(file) !== folderFilter) return false;
    if (favoriteFilter === 'favorites' && !file.favorite) return false;
    if (favoriteFilter === 'unstarred' && file.favorite) return false;

    if (filterType === 'all') return true;

    const ext = getFileExtension(file.filename);
    if (filterType === 'images') return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    if (filterType === 'videos') return ['mp4', 'webm', 'mov', 'avi'].includes(ext);
    if (filterType === 'documents') return ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext);

    return true;
  }).sort((a, b) => {
    const normalizeString = (value: string | undefined) => (value || '').toLowerCase();
    const leftValue = (() => {
      switch (sortKey) {
        case 'favorite':
          return Number(Boolean(a.favorite));
        case 'folder':
          return normalizeString(a.folder);
        case 'tags':
          return a.tags?.length || 0;
        case 'updatedAt':
          return a.updatedAt || 0;
        case 'filename':
          return normalizeString(getFileDisplayName(a));
        case 'ip':
          return normalizeString(a.ip);
        default:
          return (a[sortKey] as string | number | undefined) ?? '';
      }
    })();
    const rightValue = (() => {
      switch (sortKey) {
        case 'favorite':
          return Number(Boolean(b.favorite));
        case 'folder':
          return normalizeString(b.folder);
        case 'tags':
          return b.tags?.length || 0;
        case 'updatedAt':
          return b.updatedAt || 0;
        case 'filename':
          return normalizeString(getFileDisplayName(b));
        case 'ip':
          return normalizeString(b.ip);
        default:
          return (b[sortKey] as string | number | undefined) ?? '';
      }
    })();

    if (leftValue < rightValue) return sortOrder === 'asc' ? -1 : 1;
    if (leftValue > rightValue) return sortOrder === 'asc' ? 1 : -1;

    if (sortKey !== 'timestamp') {
      return sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
    }

    return 0;
  });

  // Map filename → total download count from analytics topFiles
  const downloadCountMap = Object.fromEntries(
    (analytics?.topFiles || []).map(f => [f.filename, f.totalDownloads])
  );

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const uploadsToday = files.filter(f => {
    const today = new Date();
    const uploadDate = new Date(f.timestamp);
    return uploadDate.toDateString() === today.toDateString();
  }).length;
  const uniqueIPs = new Set(files.map(f => f.ip).filter(Boolean)).size;
  const now = Date.now();
  const soonThreshold = 48 * 60 * 60 * 1000;
  const expiringSoonFiles = files
    .filter((file) => {
      const expiresAt = file.expiresAt || (file.lastAccessTime ? file.lastAccessTime + 15 * 24 * 60 * 60 * 1000 : undefined);
      return typeof expiresAt === 'number' && expiresAt > now && expiresAt - now <= soonThreshold;
    })
    .sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0))
    .slice(0, 8);
  const notificationAlerts = [
    ...analytics?.recentDownloads.slice(0, 6).map((download) => ({
      kind: 'download' as const,
      title: download.filename,
      detail: `${download.ip} • ${formatTimeAgo(download.timestamp)}`,
      timestamp: download.timestamp,
    })) || [],
    ...expiringSoonFiles.map((file) => ({
      kind: 'expiry' as const,
      title: file.filename,
      detail: `Expires ${file.expiresAt ? new Date(file.expiresAt).toLocaleString() : 'soon'}`,
      timestamp: file.expiresAt || file.lastAccessTime || file.timestamp,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 30% 20%, var(--wash-violet) 0%, var(--wash-base) 55%), radial-gradient(ellipse at 75% 80%, var(--wash-teal) 0%, var(--wash-base) 60%)',
      backgroundAttachment: 'fixed',
      color: 'var(--c-text)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-text)', letterSpacing: '-0.01em' }}>Relay</span>
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: '999px',
                color: 'var(--c-accent-mint)', background: 'rgba(126,244,203,0.14)', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Admin
              </span>
            </div>
            <h1 style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(1.6rem, 3vw, 2rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
            }}>
              Operations
            </h1>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--c-dim)',
              marginTop: '0.3rem',
            }}>
              Uploads, moderation, and account activity across Relay
            </p>
          </div>

          {/* marginRight reserves space for the fixed global theme toggle
              (top-right, see app/components/ThemeToggle.tsx) so it never
              sits on top of the Logout button at narrower viewport widths. */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginRight: '3.5rem' }}>
            <a
              href="/admin/analytics"
              style={{
                padding: '0.625rem 1.25rem',
                background: 'var(--surface-card-strong)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--border-input)',
                borderRadius: '999px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
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
                background: 'var(--surface-card-strong)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--border-input)',
                borderRadius: '999px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
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
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Ops status strip — at-a-glance triage signal, not just decoration */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.7rem',
          marginBottom: '2rem',
        }}>
          {(() => {
            const openReports = reports.filter((r) => r.status === 'open').length;
            const csamReports = reports.filter((r) => r.status === 'open' && r.category === 'csam').length;
            const chips = [
              {
                label: 'Open reports',
                value: openReports,
                tone: csamReports > 0 ? 'error' : openReports > 0 ? 'warning' : 'ok',
              },
              { label: 'Blacklist rules', value: blacklistRules.length, tone: 'neutral' as const },
              { label: 'Quarantined files', value: quarantineRecords.length, tone: quarantineRecords.length > 0 ? 'warning' as const : 'ok' as const },
              { label: 'Storage', value: formatFileSize(storageStats?.storage.bytes ?? totalSize), tone: 'neutral' as const },
            ];
            const toneColors: Record<string, { fg: string; bg: string }> = {
              ok: { fg: 'var(--c-accent-mint)', bg: 'rgba(126,244,203,0.1)' },
              warning: { fg: '#f2c879', bg: 'rgba(242,200,121,0.1)' },
              error: { fg: 'var(--c-accent-error)', bg: 'rgba(255,158,158,0.1)' },
              neutral: { fg: 'var(--c-text)', bg: 'var(--surface-card)' },
            };
            return chips.map((chip) => {
              const colors = toneColors[chip.tone];
              return (
                <div key={chip.label} style={{
                  padding: '0.9rem 1.1rem',
                  borderRadius: '14px',
                  border: `1px solid ${chip.tone === 'neutral' ? 'var(--border-default)' : colors.bg.replace('0.1', '0.3')}`,
                  background: colors.bg,
                }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    {chip.label}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: colors.fg }}>
                    {chip.value}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Plus Access Manager */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 300,
            marginBottom: '0.75rem',
            color: 'var(--c-text)'
          }}>
            ⭐ Manage Relay Plus Access 
          </h3>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--c-dim)' }}>Invite TTL (hours)</label>
            <input
              type="number"
              min={1}
              value={inviteTtlHours}
              onChange={(e) => setInviteTtlHours(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: '110px',
                padding: '0.45rem 0.6rem',
                background: 'var(--surface-input)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                color: 'var(--c-text)',
                fontSize: '0.85rem'
              }}
            />
            <button
              onClick={createPlusInvite}
              disabled={creatingInvite}
              style={{
                padding: '0.55rem 1rem',
                background: 'rgba(233,236,242,0.15)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(233,236,242,0.35)',
                borderRadius: '999px',
                color: 'var(--c-text)',
                fontSize: '0.85rem',
                cursor: creatingInvite ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              {creatingInvite ? 'Creating...' : 'Generate Plus signup link'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <div style={{
              background: 'var(--surface-well)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--c-text)', marginBottom: '0.75rem' }}>Signup Links ({plusInvites.length})</div>
              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {plusInvites.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>No plus invites yet</div>
                )}
                {plusInvites.map((invite) => {
                  const inviteLink = `${window.location.origin}/plus?invite=${invite.token}`;
                  const isExpired = invite.expiresAt <= Date.now();
                  const isUsed = Boolean(invite.usedAt);

                  return (
                    <div key={invite.id} style={{
                      border: '1px solid var(--border-default)',
                      borderRadius: '10px',
                      padding: '0.65rem'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.45rem' }}>
                        {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'} • Expires {new Date(invite.expiresAt).toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => copyToClipboard(inviteLink)}
                          style={{
                            padding: '0.4rem 0.65rem',
                            background: 'var(--surface-card-strong)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: '1px solid var(--border-input)',
                            borderRadius: '8px',
                            color: 'var(--c-text)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}
                        >
                          Copy link
                        </button>
                        <button
                          onClick={() => deletePlusInvite(invite.id)}
                          style={{
                            padding: '0.4rem 0.65rem',
                            background: 'transparent',
                            border: '1px solid var(--border-strong)',
                            borderRadius: '8px',
                            color: 'var(--c-text)',
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
              background: 'var(--surface-well)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--c-text)', marginBottom: '0.75rem' }}>Plus Accounts ({plusUsers.length})</div>
              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {plusUsers.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>No plus users yet</div>
                )}
                {plusUsers.map((user) => (
                  <div key={user.id} style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: '10px',
                    padding: '0.65rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--c-text)' }}>{user.email}</span>
                        {(() => {
                          const badge = !user.isPaidSubscriber
                            ? { label: 'Invited', color: 'var(--c-dim)', bg: 'rgba(138,146,161,0.14)' }
                            : user.planStatus === 'canceled'
                              ? { label: 'Canceled', color: 'var(--c-accent-error)', bg: 'rgba(255,158,158,0.14)' }
                              : user.planStatus === 'past_due'
                                ? { label: 'Past due', color: '#f2c879', bg: 'rgba(242,200,121,0.14)' }
                                : { label: 'Active', color: 'var(--c-accent-mint)', bg: 'rgba(126,244,203,0.14)' };
                          return (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px',
                              color: badge.color, background: badge.bg, letterSpacing: '0.03em', textTransform: 'uppercase',
                            }}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--c-dim)' }}>
                        Created {new Date(user.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePlusUser(user.id, user.email)}
                      style={{
                        padding: '0.38rem 0.62rem',
                        background: 'transparent',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '8px',
                        color: 'var(--c-text)',
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
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>Total Files</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{files.length}</div>
          </div>
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>Total Storage</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {formatFileSize(storageStats?.storage.bytes ?? totalSize)}
            </div>
          </div>
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>Uploads Today</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{uploadsToday}</div>
          </div>
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>Unique IPs</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{uniqueIPs}</div>
          </div>
        </div>

        {storageStats && (
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 300, color: 'var(--c-text)', margin: 0 }}>
                💸 Storage usage + cost estimates
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--c-dim)' }}>
                Updated {formatTimeAgo(storageStats.storage.updatedAt)} {storageStats.cached ? '• cached' : ''}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{
                background: 'var(--surface-well)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.4rem' }}>Storage (current)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatFileSize(storageStats.storage.bytes)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>{storageStats.storage.objects} objects</div>
              </div>
              <div style={{
                background: 'var(--surface-well)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.4rem' }}>Est. storage cost / mo</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(storageStats.cost.storageMonthly)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>${storageStats.cost.pricing.storagePerGbMonth}/GB-mo</div>
              </div>
              <div style={{
                background: 'var(--surface-well)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.4rem' }}>Bandwidth cost (24h)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(storageStats.cost.bandwidth24h)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>{formatFileSize(storageStats.bandwidth.bytes24h)}</div>
              </div>
              <div style={{
                background: 'var(--surface-well)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '1.1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.4rem' }}>Bandwidth cost (7d)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(storageStats.cost.bandwidth7days)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>{formatFileSize(storageStats.bandwidth.bytes7days)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Section */}
        {analytics && (
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
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
                color: 'var(--c-text)',
                margin: 0
              }}>
                📊 Analytics Dashboard
              </h3>
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '10px',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)'
                }}
              >
                {showAnalytics ? 'Hide' : 'Show'}
              </button>
            </div>

            {showAnalytics && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.1rem'
                }}>
                  <div style={{ background: 'var(--surface-well)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.35rem' }}>Recent downloads</div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{analytics.recentDownloads.length}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>Tracked events</div>
                  </div>
                  <div style={{ background: 'var(--surface-well)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.35rem' }}>Expiring soon</div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{expiringSoonFiles.length}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>Within 48 hours</div>
                  </div>
                  <div style={{ background: 'var(--surface-well)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.35rem' }}>Quarantined</div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{quarantineRecords.length}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>Flagged files</div>
                  </div>
                </div>

                <div style={{
                  marginBottom: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1rem'
                }}>
                  <div style={{ background: 'var(--surface-well)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--c-text)', marginBottom: '0.75rem' }}>Recent activity</div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.55rem' }}>
                      {notificationAlerts.length === 0 ? (
                        <div style={{ color: 'var(--c-dim)', fontSize: '0.8rem' }}>No activity yet.</div>
                      ) : notificationAlerts.map((alert, index) => (
                        <div key={`${alert.kind}-${alert.title}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '0.65rem 0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-input)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--c-text)', wordBreak: 'break-all' }}>{alert.title}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>{alert.detail}</div>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: alert.kind === 'download' ? 'var(--c-accent-mint)' : '#ffd1a3', whiteSpace: 'nowrap' }}>
                            {alert.kind === 'download' ? 'downloaded' : 'expiring'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-well)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--c-text)', marginBottom: '0.75rem' }}>Expiring soon</div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.55rem' }}>
                      {expiringSoonFiles.length === 0 ? (
                        <div style={{ color: 'var(--c-dim)', fontSize: '0.8rem' }}>No files expiring within 48 hours.</div>
                      ) : expiringSoonFiles.map((file) => (
                        <div key={file.url} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '0.65rem 0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-input)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--c-text)', wordBreak: 'break-all' }}>{file.filename}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>{file.expiresAt ? new Date(file.expiresAt).toLocaleString() : 'Based on last access time'}</div>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#ffd1a3', whiteSpace: 'nowrap' }}>
                            expiring
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Analytics Stats Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    background: 'var(--surface-well)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>🔴 Live Visitors</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.visitors.live}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>Last 5 minutes</div>
                  </div>
                  <div style={{
                    background: 'var(--surface-well)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>👥 Unique Visitors (24h)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.visitors.unique24h}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>Total: {analytics.visitors.unique}</div>
                  </div>
                  <div style={{
                    background: 'var(--surface-well)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>📄 Page Views (24h)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.pageViews.last24h}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>Total: {analytics.pageViews.total}</div>
                  </div>
                  <div style={{
                    background: 'var(--surface-well)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>⬇️ Downloads (24h)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{analytics.downloads.last24h}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>Total: {analytics.downloads.total}</div>
                  </div>
                  <div style={{
                    background: 'var(--surface-well)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>📈 7-Day Page Views</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{analytics.pageViews.last7days}</div>
                  </div>
                  <div style={{
                    background: 'var(--surface-well)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>📈 7-Day Downloads</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{analytics.downloads.last7days}</div>
                  </div>
                </div>

                {/* Top Downloaded Files */}
                {analytics.topFiles && analytics.topFiles.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: 'var(--c-text)',
                      marginBottom: '1rem'
                    }}>
                      🏆 Most Downloaded Files
                    </h4>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
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
                              color: index < 3 ? '#FFD700' : 'var(--c-dim)',
                              textAlign: 'center'
                            }}>
                              #{index + 1}
                            </div>
                            <div style={{
                              fontSize: '0.875rem',
                              color: 'var(--c-text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {file.filename}
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: 'var(--c-dim)',
                              whiteSpace: 'nowrap'
                            }}>
                              <strong>{file.totalDownloads}</strong> total
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: 'var(--c-dim)',
                              whiteSpace: 'nowrap'
                            }}>
                              {file.last24h} today
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: 'var(--c-dim)',
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
                      color: 'var(--c-text)',
                      marginBottom: '1rem'
                    }}>
                      🕒 Recent Downloads
                    </h4>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
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
                              color: 'var(--c-text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {download.filename}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'var(--c-dim)',
                              fontFamily: 'monospace'
                            }}>
                              {download.ip}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'var(--c-dim)',
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
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
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
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                outline: 'none',
                fontFamily: 'var(--font-body)'
              }}
            />
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)'
              }}
            >
              <option value="all">All Types</option>
              <option value="images">Images</option>
              <option value="videos">Videos</option>
              <option value="documents">Documents</option>
            </select>

            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)'
              }}
            >
              <option value="all">All folders</option>
              {folderOptions.map((folder) => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>

            <select
              value={favoriteFilter}
              onChange={(e) => setFavoriteFilter(e.target.value as typeof favoriteFilter)}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)'
              }}
            >
              <option value="all">All files</option>
              <option value="favorites">Favorites</option>
              <option value="unstarred">Unstarred</option>
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)'
              }}
            >
              <option value="timestamp">Newest</option>
              <option value="updatedAt">Recently edited</option>
              <option value="favorite">Favorite</option>
              <option value="folder">Folder</option>
              <option value="tags">Tag count</option>
              <option value="filename">Name</option>
              <option value="size">Size</option>
              <option value="ip">IP</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              style={{
                padding: '0.75rem 0.9rem',
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)'
              }}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>

            <button
              onClick={runCleanup}
              disabled={runningCleanup}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-card-strong)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: runningCleanup ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              {runningCleanup ? '🧹 Cleaning...' : '🧹 Cleanup'}
            </button>

            <button
              onClick={() => exportData('json')}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-card-strong)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              📥 Export JSON
            </button>

            <button
              onClick={() => exportData('csv')}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-card-strong)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              📥 Export CSV
            </button>
          </div>

          {selectedFiles.size > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--c-dim)', fontSize: '0.875rem' }}>
                {selectedFiles.size} selected
              </span>
              <input
                value={bulkMoveFolder}
                onChange={(e) => setBulkMoveFolder(e.target.value)}
                placeholder="Target folder"
                style={{
                  padding: '0.5rem 0.7rem',
                  background: 'var(--surface-input)',
                  border: '1px solid var(--border-input)',
                  borderRadius: '10px',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  minWidth: '180px'
                }}
              />
              <button
                onClick={applyBulkMove}
                disabled={organizingFiles || !bulkMoveFolder.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--surface-card-strong)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-input)',
                  borderRadius: '10px',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  cursor: organizingFiles || !bulkMoveFolder.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                📁 Move Selected
              </button>
              <input
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
                placeholder="Tags, comma separated"
                style={{
                  padding: '0.5rem 0.7rem',
                  background: 'var(--surface-input)',
                  border: '1px solid var(--border-input)',
                  borderRadius: '10px',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  minWidth: '220px'
                }}
              />
              <button
                onClick={applyBulkTags}
                disabled={organizingFiles}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--surface-card-strong)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-input)',
                  borderRadius: '10px',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  cursor: organizingFiles ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                🏷️ Apply Tags
              </button>
              <button
                onClick={deleteSelectedDirect}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(180,50,50,0.2)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(220,80,80,0.35)',
                  borderRadius: '10px',
                  color: 'var(--c-accent-error)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
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
                  fontFamily: 'var(--font-body)',
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
                  fontFamily: 'var(--font-body)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                🧪 Quarantine Selected
              </button>
              <button
                onClick={() => runBulkAction('unquarantine')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--surface-input)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '10px',
                  color: '#c3cad6',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
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
                  border: '1px solid var(--border-strong)',
                  borderRadius: '10px',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)'
                }}
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* Reported content */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 300, margin: 0, color: 'var(--c-text)' }}>
              🚩 Reported content ({reports.filter((r) => r.status === 'open').length} open)
            </h3>
            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value as typeof reportFilter)}
              style={{
                padding: '0.45rem 0.65rem',
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '8px',
                color: 'var(--c-text)',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
          </div>

          <div style={{ display: 'grid', gap: '0.7rem', maxHeight: '480px', overflowY: 'auto' }}>
            {reports.filter((r) => reportFilter === 'all' || r.status === reportFilter).length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>No {reportFilter === 'all' ? '' : reportFilter} reports</div>
            )}
            {reports
              .filter((r) => reportFilter === 'all' || r.status === reportFilter)
              .map((report) => {
                const categoryLabels: Record<string, string> = {
                  'illegal-content': 'Illegal content',
                  csam: 'CSAM',
                  malware: 'Malware/Ransomware',
                  copyright: 'Copyright',
                  'phishing-scam': 'Phishing/Scam',
                  other: 'Other',
                };
                const isBusy = reportActionId === report.id;
                return (
                  <div key={report.id} style={{
                    border: report.category === 'csam' ? '1px solid rgba(255,100,100,0.4)' : '1px solid var(--border-default)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px',
                            color: report.category === 'csam' ? 'var(--c-accent-error)' : 'var(--c-accent-mint)',
                            background: report.category === 'csam' ? 'rgba(255,158,158,0.14)' : 'rgba(126,244,203,0.14)',
                            letterSpacing: '0.03em', textTransform: 'uppercase',
                          }}>
                            {categoryLabels[report.category] || report.category}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--c-dim)' }}>
                            Reported {new Date(report.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--c-text)', wordBreak: 'break-all', marginTop: '0.35rem' }}>
                          {report.url}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#a9b2c1', marginTop: '0.35rem', lineHeight: 1.5 }}>
                          {report.description}
                        </div>
                        {report.reporterEmail && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)', marginTop: '0.3rem' }}>
                            Reporter: {report.reporterEmail}
                          </div>
                        )}
                        {report.status !== 'open' && (
                          <div style={{
                            marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '8px',
                            background: 'var(--surface-card)', border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.7rem', color: '#a9b2c1',
                          }}>
                            {(() => {
                              const actionLabels: Record<string, string> = {
                                disabled: '🔒 Link disabled',
                                deleted: '🗑️ File deleted',
                                dismissed: '✕ Dismissed',
                              };
                              const label = (report.resolvedAction && actionLabels[report.resolvedAction]) || `Marked ${report.status}`;
                              return (
                                <>
                                  {label} by admin{report.resolvedByIp ? ` (${report.resolvedByIp})` : ''}
                                  {report.resolvedAt ? ` · ${new Date(report.resolvedAt).toLocaleString()}` : ''}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flexShrink: 0 }}>
                        {report.status === 'open' ? (
                          <>
                            <button
                              onClick={() => disableReportedLink(report)}
                              disabled={isBusy}
                              style={{
                                padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid rgba(242,200,121,0.4)',
                                background: 'rgba(242,200,121,0.12)', color: '#f2c879', fontSize: '0.72rem', fontWeight: 600,
                                cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                              }}
                            >
                              Disable link
                            </button>
                            <button
                              onClick={() => deleteReportedFile(report)}
                              disabled={isBusy}
                              style={{
                                padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid rgba(255,158,158,0.4)',
                                background: 'rgba(255,158,158,0.12)', color: 'var(--c-accent-error)', fontSize: '0.72rem', fontWeight: 600,
                                cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                              }}
                            >
                              Delete file
                            </button>
                            <button
                              onClick={() => dismissReport(report)}
                              disabled={isBusy}
                              style={{
                                padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-strong)',
                                background: 'transparent', color: 'var(--c-text)', fontSize: '0.72rem',
                                cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                              }}
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => reopenReport(report)}
                            disabled={isBusy}
                            style={{
                              padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-strong)',
                              background: 'transparent', color: 'var(--c-text)', fontSize: '0.72rem',
                              cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                            }}
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Abuse + Blacklist */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 300, marginBottom: '0.9rem', color: 'var(--c-text)' }}>
            🚫 Abuse flags + blacklist
          </h3>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <select
              value={blacklistType}
              onChange={(e) => setBlacklistType(e.target.value as 'ip' | 'filename')}
              style={{
                padding: '0.55rem 0.75rem',
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
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
                background: 'var(--surface-input)',
                border: '1px solid var(--border-input)',
                borderRadius: '10px',
                color: 'var(--c-text)',
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
                color: 'var(--c-text)',
                fontSize: '0.82rem',
                cursor: addingRule ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              {addingRule ? 'Adding...' : 'Add rule'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{
              background: 'var(--surface-well)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--c-text)', marginBottom: '0.75rem' }}>
                Blacklist rules ({blacklistRules.length})
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {blacklistRules.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>No rules yet</div>
                )}
                {blacklistRules.map((rule) => (
                  <div key={rule.id} style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: '10px',
                    padding: '0.65rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--c-text)' }}>{rule.pattern}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>{rule.type} • {new Date(rule.createdAt).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => removeBlacklistRuleById(rule.id)}
                      style={{
                        padding: '0.35rem 0.6rem',
                        background: 'transparent',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '8px',
                        color: 'var(--c-text)',
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
              background: 'var(--surface-well)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--c-text)', marginBottom: '0.75rem' }}>
                Quarantined files ({quarantineRecords.length})
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
                {quarantineRecords.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>No quarantined files</div>
                )}
                {quarantineRecords.slice(0, 25).map((record) => (
                  <div key={record.objectKey} style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: '10px',
                    padding: '0.65rem'
                  }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--c-text)', wordBreak: 'break-all' }}>{record.objectKey}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>{record.reason || 'No reason'} • {new Date(record.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Audit Log */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.9rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 300, margin: 0, color: 'var(--c-text)' }}>
              🧾 Admin audit log
            </h3>
            <select
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem', background: 'var(--surface-input)', border: '1px solid var(--border-input)',
                borderRadius: '8px', color: 'var(--c-text)', fontSize: '0.75rem', cursor: 'pointer',
              }}
            >
              <option value="all">All actions</option>
              {Array.from(new Set(auditLog.map((e) => e.action))).sort().map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
            {auditLog.filter((e) => auditActionFilter === 'all' || e.action === auditActionFilter).length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>No matching activity</div>
            )}
            {auditLog.filter((e) => auditActionFilter === 'all' || e.action === auditActionFilter).map((entry) => (
              <div key={entry.id} style={{
                border: '1px solid var(--border-default)',
                borderRadius: '10px',
                padding: '0.65rem'
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--c-text)' }}>{entry.action}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)' }}>
                  {new Date(entry.timestamp).toLocaleString()} • {entry.actorIp || 'unknown'}
                  {entry.target ? ` • ${entry.target}` : ''}
                </div>
                {entry.meta && Object.keys(entry.meta).length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#a9b2c1', marginTop: '0.35rem', display: 'grid', gap: '0.15rem' }}>
                    {Object.entries(entry.meta).map(([key, value]) => (
                      value === undefined || value === null || value === '' ? null : (
                        <div key={key} style={{ wordBreak: 'break-word' }}>
                          <strong style={{ color: 'var(--c-dim)' }}>{key}:</strong> {String(value)}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* R2 File Manager — browses the bucket directly, not just tracked history */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 300, margin: 0, color: 'var(--c-text)' }}>
              📦 File Manager (R2) {r2Loaded ? `(${r2Files.length} loaded)` : ''}
            </h3>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <input
                value={r2Prefix}
                onChange={(e) => setR2Prefix(e.target.value)}
                placeholder="Key prefix (optional)"
                style={{
                  padding: '0.45rem 0.65rem', background: 'var(--surface-input)',
                  border: '1px solid var(--border-input)', borderRadius: '8px',
                  color: 'var(--c-text)', fontSize: '0.78rem', outline: 'none', width: '180px',
                }}
              />
              <button
                onClick={() => loadR2Files(true)}
                disabled={r2Loading}
                style={{
                  padding: '0.45rem 0.8rem', background: 'rgba(233,236,242,0.15)', border: '1px solid rgba(233,236,242,0.35)',
                  borderRadius: '999px', color: 'var(--c-text)', fontSize: '0.78rem', cursor: r2Loading ? 'not-allowed' : 'pointer',
                }}
              >
                {r2Loading ? 'Loading…' : r2Loaded ? 'Reload' : 'Browse R2'}
              </button>
            </div>
          </div>

          {!r2Loaded ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>
              Not loaded yet - click &quot;Browse R2&quot; to list objects directly from storage (bypasses the tracked-history table above, so orphaned objects show up too).
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto' }}>
                {r2Files.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--c-dim)' }}>No objects found</div>
                )}
                {r2Files.map((file) => {
                  const isBusy = r2ActionKey === file.key;
                  return (
                    <div key={file.key} style={{
                      border: '1px solid var(--border-default)', borderRadius: '10px', padding: '0.65rem',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
                    }}>
                      <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--c-text)', wordBreak: 'break-all' }}>
                            {file.filename || file.key}
                          </span>
                          {!file.tracked && (
                            <span style={{
                              fontSize: '0.6rem', fontWeight: 700, padding: '0.08rem 0.4rem', borderRadius: '999px',
                              color: '#f2c879', background: 'rgba(242,200,121,0.14)', letterSpacing: '0.03em', textTransform: 'uppercase',
                            }}>
                              Orphaned
                            </span>
                          )}
                          {file.quarantined && (
                            <span style={{
                              fontSize: '0.6rem', fontWeight: 700, padding: '0.08rem 0.4rem', borderRadius: '999px',
                              color: 'var(--c-accent-error)', background: 'rgba(255,158,158,0.14)', letterSpacing: '0.03em', textTransform: 'uppercase',
                            }}>
                              Quarantined
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                          {file.key} · {formatFileSize(file.size)}{file.lastModified ? ` · ${new Date(file.lastModified).toLocaleString()}` : ''}
                          {file.ip ? ` · ${file.ip}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flexShrink: 0 }}>
                        <button
                          onClick={() => r2FileAction(file, file.quarantined ? 'unquarantine' : 'quarantine')}
                          disabled={isBusy}
                          style={{
                            padding: '0.32rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(242,200,121,0.4)',
                            background: 'rgba(242,200,121,0.12)', color: '#f2c879', fontSize: '0.68rem', fontWeight: 600,
                            cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                          }}
                        >
                          {file.quarantined ? 'Unquarantine' : 'Quarantine'}
                        </button>
                        <button
                          onClick={() => r2FileAction(file, 'delete')}
                          disabled={isBusy}
                          style={{
                            padding: '0.32rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,158,158,0.4)',
                            background: 'rgba(255,158,158,0.12)', color: 'var(--c-accent-error)', fontSize: '0.68rem', fontWeight: 600,
                            cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {r2Cursor && (
                <button
                  onClick={() => loadR2Files(false)}
                  disabled={r2Loading}
                  style={{
                    marginTop: '0.8rem', padding: '0.5rem 1rem', background: 'transparent',
                    border: '1px solid var(--border-strong)', borderRadius: '999px', color: 'var(--c-text)',
                    fontSize: '0.78rem', cursor: r2Loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {r2Loading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>

        {/* File Manager — organization and delete panel */}
        <div style={{
          background: 'var(--surface-card)',
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
              <h3 style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--c-text)', marginBottom: '0.35rem', fontFamily: 'var(--font-body)' }}>
                🗂️ File Manager
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--c-dim)', margin: 0, lineHeight: 1.5 }}>
                Organize files with folders, tags, favorites, and bulk moves. Delete actions still <strong style={{ color: '#a0a0a0' }}>permanently remove files from Cloudflare R2</strong> and invalidate their public URL immediately.
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
                    background: 'var(--surface-card-strong)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--border-input)',
                    borderRadius: '999px',
                    color: '#c3cad6',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                >
                  {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? 'Deselect All' : `Select All (${filteredFiles.length})`}
                </button>
              )}
              {selectedFiles.size > 0 && (
                <>
                  <span style={{ color: 'var(--c-dim)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
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
                      color: 'var(--c-accent-error)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: deletingSilent.size > 0 ? 'not-allowed' : 'pointer',
                      opacity: deletingSilent.size > 0 ? 0.6 : 1,
                      fontFamily: 'var(--font-body)',
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
                      border: '1px solid var(--border-input)',
                      borderRadius: '999px',
                      color: 'var(--c-dim)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)'
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
            <div style={{ color: 'var(--c-dim)', fontSize: '0.875rem', padding: '1rem 0' }}>Loading files...</div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ color: 'var(--c-dim)', fontSize: '0.875rem', padding: '1rem 0' }}>No files found. {searchQuery && 'Try clearing the search filter.'}</div>
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
                      background: isSelected ? 'rgba(233,236,242,0.07)' : 'var(--surface-well)',
                      border: isSelected ? '1px solid var(--border-input)' : '1px solid var(--surface-card-strong)',
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
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--c-text)', wordBreak: 'break-all', lineHeight: 1.35 }}>
                        {getFileDisplayName(file)}
                      </div>
                      <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {file.favorite && (
                          <span style={{
                            padding: '0.16rem 0.45rem',
                            borderRadius: '999px',
                            border: '1px solid rgba(255, 220, 120, 0.4)',
                            background: 'rgba(255, 205, 80, 0.14)',
                            color: '#ffe39c',
                            fontSize: '0.65rem',
                            letterSpacing: '0.04em'
                          }}>
                            Favorite
                          </span>
                        )}
                        <span style={{
                          padding: '0.16rem 0.45rem',
                          borderRadius: '999px',
                          border: '1px solid var(--border-default)',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#d0d6e0',
                          fontSize: '0.65rem',
                          letterSpacing: '0.04em'
                        }}>
                          {getFileFolder(file)}
                        </span>
                        {(file.tags || []).slice(0, 4).map((tag) => (
                          <span key={tag} style={{
                            padding: '0.16rem 0.45rem',
                            borderRadius: '999px',
                            border: '1px solid rgba(200, 220, 255, 0.18)',
                            background: 'rgba(120, 140, 255, 0.12)',
                            color: '#dce2ff',
                            fontSize: '0.65rem',
                            letterSpacing: '0.03em'
                          }}>
                            {tag}
                          </span>
                        ))}
                        {(file.tags || []).length > 4 && (
                          <span style={{
                            padding: '0.16rem 0.45rem',
                            borderRadius: '999px',
                            border: '1px solid var(--border-default)',
                            background: 'var(--surface-card)',
                            color: 'var(--c-dim)',
                            fontSize: '0.65rem'
                          }}>
                            +{(file.tags || []).length - 4}
                          </span>
                        )}
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
                      <div style={{ fontSize: '0.72rem', color: 'var(--c-dim)', marginTop: '0.2rem' }}>
                        {formatFileSize(file.size)} &bull; {formatTimestamp(file.timestamp)}{file.ip ? ` · ${file.ip}` : ''}
                        {downloadCountMap[file.filename] !== undefined && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--c-accent-mint)' }}>
                            &bull; {downloadCountMap[file.filename]} dl
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {feedback === 'ok' && (
                        <span style={{ fontSize: '0.75rem', color: '#4ff8c0' }}>✓ Deleted</span>
                      )}
                      {feedback === 'err' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--c-accent-error)' }}>✗ Failed</span>
                      )}
                      <button
                        onClick={() => copyToClipboard(file.url)}
                        title="Copy link"
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid var(--border-default)',
                          color: '#c3cad6',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => toggleFavoriteFile(file)}
                        disabled={organizingFiles}
                        title={file.favorite ? 'Remove favorite' : 'Mark as favorite'}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          background: file.favorite ? 'rgba(255,205,80,0.18)' : 'rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: file.favorite ? '1px solid rgba(255,220,120,0.35)' : '1px solid var(--border-default)',
                          color: file.favorite ? '#ffe39c' : '#c3cad6',
                          fontSize: '0.72rem',
                          cursor: organizingFiles ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-body)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {file.favorite ? '★' : '☆'}
                      </button>
                      <button
                        onClick={() => renameFile(file)}
                        disabled={organizingFiles}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid var(--border-default)',
                          color: '#d0d6e0',
                          fontSize: '0.75rem',
                          cursor: organizingFiles ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-body)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => moveFile(file)}
                        disabled={organizingFiles}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid var(--border-default)',
                          color: '#d0d6e0',
                          fontSize: '0.75rem',
                          cursor: organizingFiles ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-body)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Move
                      </button>
                      <button
                        onClick={() => editTags(file)}
                        disabled={organizingFiles}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid var(--border-default)',
                          color: '#d0d6e0',
                          fontSize: '0.75rem',
                          cursor: organizingFiles ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-body)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Tags
                      </button>
                      <button
                        onClick={() => deleteFileDirect(file.url)}
                        disabled={isDeleting}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          background: isDeleting ? 'var(--surface-card)' : 'rgba(180,50,50,0.2)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: isDeleting ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(220,80,80,0.35)',
                          color: isDeleting ? 'var(--c-dim)' : 'var(--c-accent-error)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          fontFamily: 'var(--font-body)',
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
                          border: file.quarantined ? '1px solid var(--border-default)' : '1px solid rgba(255,200,100,0.35)',
                          color: file.quarantined ? 'var(--c-dim)' : '#ffd1a3',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
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
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            color: '#d0d6e0',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-body)',
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

      </div>
    </div>
  );
}
