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
  permissions: any;
  rateLimit: any;
  warning: string;
}

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
    <div className="min-h-screen bg-[#0b0b0d] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Developer Dashboard</h1>
          <p className="text-gray-400">Manage your API keys and integrate with our CDN</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Total Keys</div>
            <div className="text-3xl font-bold">{keys.length}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Active Keys</div>
            <div className="text-3xl font-bold">{keys.filter(k => k.isActive).length}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Total Uploads</div>
            <div className="text-3xl font-bold">{keys.reduce((sum, k) => sum + k.usage.uploadCount, 0)}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Total Requests</div>
            <div className="text-3xl font-bold">{keys.reduce((sum, k) => sum + k.usage.requestCount, 0)}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            {showCreateForm ? 'Cancel' : '+ Create New API Key'}
          </button>
          <button
            onClick={() => router.push('/developers/docs')}
            className="bg-white/10 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/20 transition border border-white/20"
          >
            📖 View Documentation
          </button>
        </div>

        {/* Create Key Form */}
        {showCreateForm && (
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 mb-8">
            <h2 className="text-2xl font-bold mb-4">Create New API Key</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Key Name</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production Server"
                  className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Permissions</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uploadPerm}
                      onChange={(e) => setUploadPerm(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Upload</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={downloadPerm}
                      onChange={(e) => setDownloadPerm(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Download</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deletePerm}
                      onChange={(e) => setDeletePerm(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Delete</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={listPerm}
                      onChange={(e) => setListPerm(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>List</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Requests Per Hour</label>
                  <input
                    type="number"
                    value={requestsPerHour}
                    onChange={(e) => setRequestsPerHour(parseInt(e.target.value))}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Max Upload Size (MB)</label>
                  <input
                    type="number"
                    value={uploadSizeMB}
                    onChange={(e) => setUploadSizeMB(parseInt(e.target.value))}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Expires In (days, optional)</label>
                <input
                  type="number"
                  value={expiresInDays || ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Leave empty for no expiration"
                  className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-white/40"
                />
              </div>

              <button
                onClick={createKey}
                disabled={creating}
                className="w-full bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create API Key'}
              </button>
            </div>
          </div>
        )}

        {/* API Keys List */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold">Your API Keys</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No API keys yet. Create one to get started!
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {keys.map((key) => (
                <div key={key.id} className="p-6 hover:bg-white/5 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{key.name}</h3>
                      <p className="text-sm text-gray-400 font-mono">{key.keyPreview}</p>
                    </div>
                    <div className="flex gap-2">
                      {key.isActive ? (
                        <>
                          <button
                            onClick={() => revokeKey(key.id)}
                            className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition text-sm"
                          >
                            Revoke
                          </button>
                          <button
                            onClick={() => deleteKey(key.id)}
                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition text-sm"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">
                          Revoked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Created</div>
                      <div className="text-sm">{formatDate(key.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Last Used</div>
                      <div className="text-sm">{formatDate(key.lastUsedAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Expires</div>
                      <div className="text-sm">{key.expiresAt ? formatDate(key.expiresAt) : 'Never'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Status</div>
                      <div className="text-sm">
                        {key.isActive ? (
                          <span className="text-green-400">● Active</span>
                        ) : (
                          <span className="text-red-400">● Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Requests</div>
                      <div className="font-mono">{key.usage.requestCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Uploads</div>
                      <div className="font-mono">{key.usage.uploadCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Downloads</div>
                      <div className="font-mono">{key.usage.downloadCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Uploaded</div>
                      <div className="font-mono">{formatBytes(key.usage.totalBytesUploaded)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Downloaded</div>
                      <div className="font-mono">{formatBytes(key.usage.totalBytesDownloaded)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-white/10 rounded">
                      {key.rateLimit.requestsPerHour} req/hr
                    </span>
                    <span className="px-2 py-1 bg-white/10 rounded">
                      Max {Math.round(key.rateLimit.uploadSizeLimit / (1024 * 1024))}MB
                    </span>
                    {key.permissions.upload && <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">Upload</span>}
                    {key.permissions.download && <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">Download</span>}
                    {key.permissions.delete && <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">Delete</span>}
                    {key.permissions.list && <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">List</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Key Modal */}
      {showNewKeyModal && newKeyData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1d] rounded-lg p-8 max-w-2xl w-full border border-white/20">
            <h2 className="text-2xl font-bold mb-4 text-green-400">✓ API Key Created!</h2>
            <p className="text-yellow-400 mb-4">⚠️ {newKeyData.warning}</p>
            
            <div className="bg-black/50 p-4 rounded-lg mb-6 border border-white/10">
              <div className="text-sm text-gray-400 mb-2">Your API Key:</div>
              <div className="font-mono text-lg break-all mb-2">{newKeyData.key}</div>
              <button
                onClick={() => copyToClipboard(newKeyData.key)}
                className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded transition"
              >
                📋 Copy to Clipboard
              </button>
            </div>

            <div className="space-y-2 text-sm mb-6">
              <div><span className="text-gray-400">Name:</span> {newKeyData.name}</div>
              <div><span className="text-gray-400">ID:</span> {newKeyData.id}</div>
              <div><span className="text-gray-400">Created:</span> {formatDate(newKeyData.createdAt)}</div>
              {newKeyData.expiresAt && (
                <div><span className="text-gray-400">Expires:</span> {formatDate(newKeyData.expiresAt)}</div>
              )}
            </div>

            <button
              onClick={() => {
                setShowNewKeyModal(false);
                setNewKeyData(null);
              }}
              className="w-full bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              I've Saved My Key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
