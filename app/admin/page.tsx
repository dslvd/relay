'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
        background: 'radial-gradient(ellipse at 30% 20%, var(--wash-violet) 0%, var(--wash-base) 55%), radial-gradient(ellipse at 75% 80%, var(--wash-teal) 0%, var(--wash-base) 60%)',
        backgroundAttachment: 'fixed',
        color: 'var(--c-text)',
        padding: '1.5rem'
      }}
    >
      <section
        style={{
          width: 'min(420px, 92vw)',
          borderRadius: '16px',
          border: '1px solid var(--border-default)',
          background: 'var(--surface-card-strong)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
          padding: '1.2rem'
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '1rem',
            fontSize: '0.78rem',
            color: 'rgba(var(--c-text-ch),0.55)',
            textDecoration: 'none',
            transition: 'color 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(var(--c-text-ch),0.55)')}
        >
          ← Back
        </Link>

        <h1 style={{ margin: '0 0 0.7rem', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Admin login
        </h1>

        <p style={{ margin: '0 0 1rem', color: 'rgba(var(--c-text-ch),0.65)', fontSize: '0.8rem' }}>
          Login to access the admin dashboard. Failed attempts are logged.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.6rem' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid var(--border-input)',
              background: 'var(--surface-input)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: 'var(--c-text)',
              fontSize: '0.8rem',
              outline: 'none',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
            }}
          />

          {error && <div style={{ fontSize: '0.78rem', color: 'var(--c-accent-error)' }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.3rem',
              width: '100%',
              padding: '0.65rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid rgba(var(--c-text-ch),0.4)',
              background: 'rgba(var(--c-text-ch),0.18)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              color: 'var(--c-text)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}
          >
            {loading ? 'Please wait...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
