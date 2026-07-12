'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  permissions: {
    upload: boolean;
    download: boolean;
    delete: boolean;
    list: boolean;
  };
  usage: {
    requestCount: number;
    uploadCount: number;
    downloadCount: number;
    totalBytesUploaded: number;
    totalBytesDownloaded: number;
  };
  rateLimit: {
    requestsPerHour: number;
    uploadSizeLimit: number;
  };
  keyPreview?: string;
}

interface NewKeyData {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  expiresAt: string | null;
  permissions: ApiKey['permissions'];
  rateLimit: ApiKey['rateLimit'];
  warning: string;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg p-4">
      <div className="text-[var(--c-dim)] text-xs mb-1">{label}</div>
      <div className="text-xl font-semibold font-mono">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--c-dim)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full bg-[var(--surface-input)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--border-strong)] transition-colors';

export default function DeveloperDashboard() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState<NewKeyData | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [keyName, setKeyName] = useState('');
  const [uploadPerm, setUploadPerm] = useState(true);
  const [downloadPerm, setDownloadPerm] = useState(true);
  const [deletePerm, setDeletePerm] = useState(false);
  const [listPerm, setListPerm] = useState(true);
  const [requestsPerHour, setRequestsPerHour] = useState(1000);
  const [uploadSizeMB, setUploadSizeMB] = useState(100);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const response = await fetch('/api/dev/keys');
      const data = await response.json();

      if (data.success) {
        setKeys(data.data.keys);
      }
    } catch (error) {
      console.error('Failed to load keys:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!keyName.trim()) {
      alert('Please enter a key name');
      return;
    }

    setCreating(true);

    try {
      const response = await fetch('/api/dev/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName,
          permissions: {
            upload: uploadPerm,
            download: downloadPerm,
            delete: deletePerm,
            list: listPerm,
          },
          rateLimit: {
            requestsPerHour,
            uploadSizeLimit: uploadSizeMB * 1024 * 1024,
          },
          expiresInDays,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNewKeyData(data.data);
        setShowNewKeyModal(true);
        setShowCreateForm(false);
        setKeyName('');
        loadKeys();
      } else {
        alert('Failed to create key: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to create key:', error);
      alert('Failed to create key');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Are you sure you want to revoke this API key?')) {
      return;
    }

    try {
      const response = await fetch(`/api/dev/keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });

      const data = await response.json();

      if (data.success) {
        loadKeys();
      } else {
        alert('Failed to revoke key: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to revoke key:', error);
      alert('Failed to revoke key');
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/dev/keys/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        loadKeys();
      } else {
        alert('Failed to delete key: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to delete key:', error);
      alert('Failed to delete key');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }

  return (
    <div
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6 sm:p-10"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-1.5">Relay API</h1>
          <p className="text-[var(--c-dim)] text-sm">Manage your API keys and integrate with Relay.</p>
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total keys" value={keys.length} />
          <StatCard label="Active keys" value={keys.filter((k) => k.isActive).length} />
          <StatCard label="Total uploads" value={keys.reduce((sum, k) => sum + k.usage.uploadCount, 0)} />
          <StatCard label="Total requests" value={keys.reduce((sum, k) => sum + k.usage.requestCount, 0)} />
        </div>

        {/* Action buttons */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition cursor-pointer"
          >
            {showCreateForm ? 'Cancel' : '+ Create new API key'}
          </button>
          <button
            onClick={() => router.push('/docs')}
            className="bg-[var(--surface-card)] text-[var(--foreground)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--surface-hover)] transition border border-[var(--border-subtle)] cursor-pointer"
          >
            View documentation
          </button>
        </div>

        {/* Create key form */}
        {showCreateForm && (
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg p-5 mb-6">
            <h2 className="text-sm font-semibold mb-4">Create new API key</h2>
            <div className="space-y-4">
              <Field label="Key name">
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production Server"
                  className={inputClass}
                />
              </Field>

              <div>
                <label className="block text-xs font-medium text-[var(--c-dim)] mb-1.5">Permissions</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={uploadPerm} onChange={(e) => setUploadPerm(e.target.checked)} className="w-3.5 h-3.5" />
                    Upload
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={downloadPerm} onChange={(e) => setDownloadPerm(e.target.checked)} className="w-3.5 h-3.5" />
                    Download
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={deletePerm} onChange={(e) => setDeletePerm(e.target.checked)} className="w-3.5 h-3.5" />
                    Delete
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={listPerm} onChange={(e) => setListPerm(e.target.checked)} className="w-3.5 h-3.5" />
                    List
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Requests per hour">
                  <input
                    type="number"
                    value={requestsPerHour}
                    onChange={(e) => setRequestsPerHour(parseInt(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Max upload size (MB)">
                  <input
                    type="number"
                    value={uploadSizeMB}
                    onChange={(e) => setUploadSizeMB(parseInt(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Expires in (days, optional)">
                <input
                  type="number"
                  value={expiresInDays || ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Leave empty for no expiration"
                  className={inputClass}
                />
              </Field>

              <button
                onClick={createKey}
                disabled={creating}
                className="w-full bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
              >
                {creating ? 'Creating…' : 'Create API key'}
              </button>
            </div>
          </div>
        )}

        {/* API keys list */}
        <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold">Your API keys</h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-[var(--c-dim)] text-sm">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="p-10 text-center text-[var(--c-dim)] text-sm">No API keys yet. Create one to get started.</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {keys.map((key) => (
                <div key={key.id} className="p-5 hover:bg-[var(--surface-hover)] transition">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold mb-0.5">{key.name}</h3>
                      <p className="text-xs text-[var(--c-dim)] font-mono">{key.keyPreview}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {key.isActive ? (
                        <>
                          <button
                            onClick={() => revokeKey(key.id)}
                            className="px-3 py-1.5 bg-[var(--surface-card)] text-amber-500 rounded-md hover:bg-amber-500/10 transition text-xs border border-[var(--border-subtle)] cursor-pointer"
                          >
                            Revoke
                          </button>
                          <button
                            onClick={() => deleteKey(key.id)}
                            className="px-3 py-1.5 bg-[var(--surface-card)] text-red-500 rounded-md hover:bg-red-500/10 transition text-xs border border-[var(--border-subtle)] cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="px-3 py-1.5 text-red-500 rounded-md text-xs">Revoked</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5">Created</div>
                      <div className="text-xs">{formatDate(key.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5">Last used</div>
                      <div className="text-xs">{formatDate(key.lastUsedAt)}</div>
                    </div>
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5">Expires</div>
                      <div className="text-xs">{key.expiresAt ? formatDate(key.expiresAt) : 'Never'}</div>
                    </div>
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5">Status</div>
                      <div className="text-xs">
                        {key.isActive ? (
                          <span className="text-[var(--c-accent-mint)]">● Active</span>
                        ) : (
                          <span className="text-red-500">● Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3 text-xs font-mono">
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5 font-sans">Requests</div>
                      {key.usage.requestCount.toLocaleString()}
                    </div>
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5 font-sans">Uploads</div>
                      {key.usage.uploadCount.toLocaleString()}
                    </div>
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5 font-sans">Downloads</div>
                      {key.usage.downloadCount.toLocaleString()}
                    </div>
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5 font-sans">Uploaded</div>
                      {formatBytes(key.usage.totalBytesUploaded)}
                    </div>
                    <div>
                      <div className="text-[0.65rem] text-[var(--c-dim)] mb-0.5 font-sans">Downloaded</div>
                      {formatBytes(key.usage.totalBytesDownloaded)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[0.65rem]">
                    <span className="px-2 py-1 bg-[var(--surface-card-strong)] rounded-md text-[var(--c-dim)]">
                      {key.rateLimit.requestsPerHour} req/hr
                    </span>
                    <span className="px-2 py-1 bg-[var(--surface-card-strong)] rounded-md text-[var(--c-dim)]">
                      Max {Math.round(key.rateLimit.uploadSizeLimit / (1024 * 1024))}MB
                    </span>
                    {key.permissions.upload && <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md">Upload</span>}
                    {key.permissions.download && <span className="px-2 py-1 bg-[var(--c-accent-mint)]/10 text-[var(--c-accent-mint)] rounded-md">Download</span>}
                    {key.permissions.delete && <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-md">Delete</span>}
                    {key.permissions.list && <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded-md">List</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New key modal */}
      {showNewKeyModal && newKeyData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--background)] rounded-lg p-6 max-w-lg w-full border border-[var(--border-default)]">
            <h2 className="text-lg font-semibold mb-3 text-[var(--c-accent-mint)]">API key created</h2>
            <p className="text-amber-500 text-sm mb-4">⚠ {newKeyData.warning}</p>

            <div className="bg-[var(--surface-well)] p-3.5 rounded-lg mb-5 border border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--c-dim)] mb-1.5">Your API key</div>
              <div className="font-mono text-sm break-all mb-2.5">{newKeyData.key}</div>
              <button
                onClick={() => copyToClipboard(newKeyData.key)}
                className="text-xs bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-md transition cursor-pointer"
              >
                Copy to clipboard
              </button>
            </div>

            <div className="space-y-1.5 text-xs mb-5">
              <div><span className="text-[var(--c-dim)]">Name:</span> {newKeyData.name}</div>
              <div><span className="text-[var(--c-dim)]">ID:</span> <span className="font-mono">{newKeyData.id}</span></div>
              <div><span className="text-[var(--c-dim)]">Created:</span> {formatDate(newKeyData.createdAt)}</div>
              {newKeyData.expiresAt && (
                <div><span className="text-[var(--c-dim)]">Expires:</span> {formatDate(newKeyData.expiresAt)}</div>
              )}
            </div>

            <button
              onClick={() => {
                setShowNewKeyModal(false);
                setNewKeyData(null);
              }}
              className="w-full bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition cursor-pointer"
            >
              I&apos;ve saved my key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
