'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // keep sessionStorage for client-side checks and rely on cookie for API auth
        sessionStorage.setItem('admin_authenticated', 'true');
        router.push('/admin/dashboard');
      } else {
        setError(data.message || 'Access denied');
        setPassword('');
      }
    } catch (err) {
      setError('Authentication failed');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
        backgroundAttachment: 'fixed',
        color: '#f5f5f5',
        padding: '1.5rem'
      }}
    >
      <section
        style={{
          width: 'min(420px, 92vw)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.13)',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
          padding: '1.2rem'
        }}
      >
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '1rem',
            fontSize: '0.78rem',
            color: 'rgba(245,245,245,0.55)',
            textDecoration: 'none',
            transition: 'color 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f5f5')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,245,245,0.55)')}
        >
          ← Back
        </a>

        <h1 style={{ margin: '0 0 0.7rem', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Admin login
        </h1>

        <p style={{ margin: '0 0 1rem', color: 'rgba(245, 245, 245, 0.65)', fontSize: '0.8rem' }}>
          Login to access the admin dashboard. Failed attempts are logged.
        </p>

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#f5f5f5',
              fontSize: '0.8rem',
              outline: 'none',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
            }}
          />

          {error && <div style={{ fontSize: '0.78rem', color: '#ffb4b4' }}>{error}</div>}

          <button
            onClick={handleSubmit as any}
            disabled={loading}
            style={{
              marginTop: '0.3rem',
              width: '100%',
              padding: '0.65rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid rgba(233,236,242,0.4)',
              background: 'rgba(233,236,242,0.18)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              color: '#eef1f6',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}
          >
            {loading ? 'Please wait...' : 'Login'}
          </button>
        </div>
      </section>
    </main>
  );
}
