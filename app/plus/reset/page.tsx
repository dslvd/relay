'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const inputStyle: React.CSSProperties = {
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
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
  }, []);

  const handleSubmit = async () => {
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Request a new one.');
      return;
    }
    if (!password || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/plus/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }
      setSuccess(true);
      window.setTimeout(() => router.push('/plus'), 1800);
    } catch {
      setError('Failed to reset password');
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
        padding: '1.5rem',
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
          padding: '1.2rem',
        }}
      >
        <h1 style={{ margin: '0 0 0.7rem', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Set a new password
        </h1>

        {success ? (
          <p style={{ margin: 0, color: 'var(--c-accent-mint)', fontSize: '0.85rem' }}>
            Password updated. Redirecting you to login...
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 1rem', color: 'rgba(var(--c-text-ch),0.65)', fontSize: '0.8rem' }}>
              This link can only be used once and expires an hour after it was requested.
            </p>

            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="New password"
                style={inputStyle}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                style={inputStyle}
                onKeyDown={(event) => { if (event.key === 'Enter') handleSubmit(); }}
              />

              {error && <div style={{ fontSize: '0.78rem', color: 'var(--c-accent-error)' }}>{error}</div>}

              <button
                onClick={handleSubmit}
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
                  boxShadow: '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                {loading ? 'Please wait...' : 'Reset password'}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
