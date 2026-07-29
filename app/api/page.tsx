'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

// Matches app/plus/dashboard/page.tsx's `glass` card treatment, so this page
// reads as the same product instead of a separate flat-Tailwind dashboard.
const glass = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
};

function StatusDot({ active, tone = 'mint' }: { active: boolean; tone?: 'mint' | 'error' }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
        background: tone === 'error' ? 'var(--c-accent-error)' : 'var(--c-accent-mint)',
        boxShadow: active ? `0 0 0 3px ${tone === 'error' ? 'rgba(255,158,158,0.18)' : 'rgba(126,244,203,0.18)'}` : 'none',
        animation: active ? 'pulseDot 1.3s ease-in-out infinite' : 'none',
        transition: 'box-shadow 0.3s ease, background 0.3s ease',
      }}
    />
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ ...glass, borderRadius: '14px', padding: '0.9rem 1rem' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: '0.4rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  borderRadius: '10px',
  border: '1px solid var(--border-input)',
  background: 'var(--surface-input)',
  color: 'var(--c-text)',
  fontSize: '0.82rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

function pillButtonStyle(variant: 'primary' | 'secondary' | 'danger' | 'warning', disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.55rem 1.1rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.18s ease',
    border: '1px solid transparent',
    opacity: disabled ? 0.55 : 1,
  };
  if (variant === 'primary') {
    return { ...base, background: 'rgba(233,236,242,0.92)', color: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)' };
  }
  if (variant === 'danger') {
    return { ...base, background: 'rgba(255,158,158,0.08)', color: 'var(--c-accent-error)', border: '1px solid rgba(255,158,158,0.22)' };
  }
  if (variant === 'warning') {
    return { ...base, background: 'rgba(251,191,36,0.08)', color: '#f2c879', border: '1px solid rgba(251,191,36,0.25)' };
  }
  return { ...base, ...glass, color: 'var(--c-text)' };
}

function permissionPillStyle(color: string): React.CSSProperties {
  return {
    padding: '0.2rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.65rem',
    fontWeight: 600,
    background: `${color}1a`,
    color,
  };
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
  const [isPlus, setIsPlus] = useState(false);

  useEffect(() => {
    loadKeys();
    fetch('/api/plus/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setIsPlus(Boolean(data?.plus)))
      .catch(() => {});
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

  function integrationSnippet(apiKeyValue: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://relay.xstlo.com';
    return [
      `curl -X POST ${base}/api/files/upload \\`,
      `  -H "Authorization: Bearer ${apiKeyValue}" \\`,
      `  -F "file=@image.png"`,
      '',
      '# Response includes:',
      '#   data.url      -> temporary signed link (expires in 24h)',
      '#   data.viewUrl  -> permanent link, safe to hotlink/embed forever',
    ].join('\n');
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
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at 30% 20%, var(--wash-violet) 0%, var(--wash-base) 55%), radial-gradient(ellipse at 75% 80%, var(--wash-teal) 0%, var(--wash-base) 60%)',
        backgroundAttachment: 'fixed',
        color: 'var(--c-text)',
        fontFamily: 'var(--font-body)',
        padding: '2.2rem clamp(1.2rem, 4vw, 3rem)',
      }}
    >
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.82); }
        }
      `}</style>

      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.8rem' }}>
          {isPlus && (
            <Link
              href="/plus/dashboard"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--c-dim)', textDecoration: 'none', marginBottom: '0.6rem' }}
            >
              ← Plus vault
            </Link>
          )}
          <div style={{
            display: 'inline-block',
            marginBottom: '0.5rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            background: 'rgba(126,244,203,0.14)',
            color: 'var(--c-accent-mint)',
          }}>
            DEVELOPER API
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 3.4vw, 1.9rem)' }}>Relay API</h1>
          <p style={{ margin: '0.3rem 0 0', color: 'var(--c-sub)', fontSize: '0.85rem' }}>
            Manage your API keys and integrate with Relay.
          </p>
        </div>

        {/* Stats overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem', marginBottom: '1.6rem' }}>
          <StatCard label="Total keys" value={keys.length} />
          <StatCard label="Active keys" value={keys.filter((k) => k.isActive).length} />
          <StatCard label="Total uploads" value={keys.reduce((sum, k) => sum + k.usage.uploadCount, 0)} />
          <StatCard label="Total requests" value={keys.reduce((sum, k) => sum + k.usage.requestCount, 0)} />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.6rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowCreateForm(!showCreateForm)} style={pillButtonStyle('primary')}>
            {showCreateForm ? 'Cancel' : '+ Create new API key'}
          </button>
          <button onClick={() => router.push('/docs')} style={pillButtonStyle('secondary')}>
            View documentation
          </button>
        </div>

        {/* Create key form */}
        {showCreateForm && (
          <div style={{ ...glass, borderRadius: '18px', padding: '1.3rem', marginBottom: '1.6rem', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Create new API key</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Key name">
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production Server"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent-mint)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                />
              </Field>

              <div>
                <label style={{ display: 'block', fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>
                  Permissions
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem', fontSize: '0.82rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={uploadPerm} onChange={(e) => setUploadPerm(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: '#7ef4cb' }} />
                    Upload
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={downloadPerm} onChange={(e) => setDownloadPerm(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: '#7ef4cb' }} />
                    Download
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={deletePerm} onChange={(e) => setDeletePerm(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: '#7ef4cb' }} />
                    Delete
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={listPerm} onChange={(e) => setListPerm(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: '#7ef4cb' }} />
                    List
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <Field label="Requests per hour">
                  <input
                    type="number"
                    value={requestsPerHour}
                    onChange={(e) => setRequestsPerHour(parseInt(e.target.value))}
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent-mint)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                  />
                </Field>
                <Field label="Max upload size (MB)">
                  <input
                    type="number"
                    value={uploadSizeMB}
                    onChange={(e) => setUploadSizeMB(parseInt(e.target.value))}
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent-mint)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                  />
                </Field>
              </div>

              <Field label="Expires in (days, optional)">
                <input
                  type="number"
                  value={expiresInDays || ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Leave empty for no expiration"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent-mint)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                />
              </Field>

              <button
                onClick={createKey}
                disabled={creating}
                style={{ ...pillButtonStyle('primary', creating), width: '100%', padding: '0.7rem 1rem' }}
              >
                {creating ? 'Creating…' : 'Create API key'}
              </button>
            </div>
          </div>
        )}

        {/* API keys list */}
        <div style={{ ...glass, borderRadius: '18px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}>
          <div style={{ padding: '1rem 1.3rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Your API keys</h2>
          </div>

          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--c-dim)', fontSize: '0.85rem' }}>Loading…</div>
          ) : keys.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--c-dim)', fontSize: '0.85rem' }}>
              No API keys yet. Create one to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem' }}>
              {keys.map((key) => (
                <div
                  key={key.id}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-well)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        {key.name}
                        <StatusDot active={key.isActive} tone={key.isActive ? 'mint' : 'error'} />
                      </div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--c-dim)', fontFamily: 'var(--font-mono)' }}>{key.keyPreview}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {key.isActive ? (
                        <>
                          <button onClick={() => copyToClipboard(integrationSnippet('YOUR_API_KEY'))} style={{ ...pillButtonStyle('secondary'), padding: '0.4rem 0.85rem', fontSize: '0.72rem' }}>
                            Copy integration link
                          </button>
                          <button onClick={() => revokeKey(key.id)} style={{ ...pillButtonStyle('warning'), padding: '0.4rem 0.85rem', fontSize: '0.72rem' }}>
                            Revoke
                          </button>
                          <button onClick={() => deleteKey(key.id)} style={{ ...pillButtonStyle('danger'), padding: '0.4rem 0.85rem', fontSize: '0.72rem' }}>
                            Delete
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--c-accent-error)', padding: '0.4rem 0.6rem' }}>Revoked</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.7rem', marginBottom: '0.7rem' }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Created</div>
                      <div style={{ fontSize: '0.74rem' }}>{formatDate(key.createdAt)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Last used</div>
                      <div style={{ fontSize: '0.74rem' }}>{formatDate(key.lastUsedAt)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Expires</div>
                      <div style={{ fontSize: '0.74rem' }}>{key.expiresAt ? formatDate(key.expiresAt) : 'Never'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Status</div>
                      <div style={{ fontSize: '0.74rem', color: key.isActive ? 'var(--c-accent-mint)' : 'var(--c-accent-error)' }}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.7rem', marginBottom: '0.7rem' }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Requests</div>
                      <div style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>{key.usage.requestCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Uploads</div>
                      <div style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>{key.usage.uploadCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Downloads</div>
                      <div style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>{key.usage.downloadCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Uploaded</div>
                      <div style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>{formatBytes(key.usage.totalBytesUploaded)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--c-dim)', marginBottom: '0.15rem' }}>Downloaded</div>
                      <div style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>{formatBytes(key.usage.totalBytesDownloaded)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={permissionPillStyle('var(--c-dim)')}>{key.rateLimit.requestsPerHour} req/hr</span>
                    <span style={permissionPillStyle('var(--c-dim)')}>Max {Math.round(key.rateLimit.uploadSizeLimit / (1024 * 1024))}MB</span>
                    {key.permissions.upload && <span style={permissionPillStyle('#7ba7ff')}>Upload</span>}
                    {key.permissions.download && <span style={permissionPillStyle('#7ef4cb')}>Download</span>}
                    {key.permissions.delete && <span style={permissionPillStyle('#ff9e9e')}>Delete</span>}
                    {key.permissions.list && <span style={permissionPillStyle('#c9a6ff')}>List</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New key modal */}
      {showNewKeyModal && newKeyData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
          <div style={{
            width: 'min(520px, 94vw)',
            borderRadius: '20px',
            border: '1px solid rgba(128,128,128,0.18)',
            background: 'var(--wash-base)',
            padding: '1.5rem',
            boxShadow: '0 22px 60px rgba(0,0,0,0.4)',
            maxHeight: '86vh',
            overflow: 'auto',
          }}>
            <h2 style={{ margin: '0 0 0.7rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--c-accent-mint)' }}>API key created</h2>
            <p style={{ fontSize: '0.8rem', color: '#f2c879', marginBottom: '1rem' }}>⚠ {newKeyData.warning}</p>

            <div style={{ background: 'var(--surface-well)', padding: '0.9rem', borderRadius: '12px', marginBottom: '1.2rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginBottom: '0.4rem' }}>Your API key</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', wordBreak: 'break-all', marginBottom: '0.6rem' }}>{newKeyData.key}</div>
              <button onClick={() => copyToClipboard(newKeyData.key)} style={{ ...pillButtonStyle('secondary'), fontSize: '0.72rem', padding: '0.4rem 0.85rem' }}>
                Copy to clipboard
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.76rem', marginBottom: '1.2rem' }}>
              <div><span style={{ color: 'var(--c-dim)' }}>Name:</span> {newKeyData.name}</div>
              <div><span style={{ color: 'var(--c-dim)' }}>ID:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{newKeyData.id}</span></div>
              <div><span style={{ color: 'var(--c-dim)' }}>Created:</span> {formatDate(newKeyData.createdAt)}</div>
              {newKeyData.expiresAt && (
                <div><span style={{ color: 'var(--c-dim)' }}>Expires:</span> {formatDate(newKeyData.expiresAt)}</div>
              )}
            </div>

            <div style={{ background: 'var(--surface-well)', padding: '0.9rem', borderRadius: '12px', marginBottom: '1.2rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--c-dim)', marginBottom: '0.5rem' }}>
                Integration link for &quot;{newKeyData.name}&quot; &mdash; paste this into that project now, since the key won&apos;t be shown again
              </div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '0 0 0.6rem', color: 'var(--c-text)' }}>
                {integrationSnippet(newKeyData.key)}
              </pre>
              <button onClick={() => copyToClipboard(integrationSnippet(newKeyData.key))} style={{ ...pillButtonStyle('secondary'), fontSize: '0.72rem', padding: '0.4rem 0.85rem' }}>
                Copy integration snippet
              </button>
            </div>

            <button
              onClick={() => {
                setShowNewKeyModal(false);
                setNewKeyData(null);
              }}
              style={{ ...pillButtonStyle('primary'), width: '100%', padding: '0.7rem 1rem' }}
            >
              I&apos;ve saved my key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
