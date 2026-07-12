'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlusPage() {
  const router = useRouter();
  const [inviteToken, setInviteToken] = useState('');
  const hasInvite = Boolean(inviteToken);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInviteToken(params.get('invite') || '');
  }, []);

  const title = hasInvite ? 'Create Relay Plus account' : 'Relay Plus login';

  const handleRegister = async () => {
    setError('');
    setSuccess('');

    if (!email || !password || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/plus/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to create account');
        return;
      }

      setSuccess('Account created. You can log in now.');
      setConfirmPassword('');
      setPassword('');
      setInviteToken('');
      window.history.replaceState({}, '', '/plus');
    } catch (registerError) {
      setError('Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/plus/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Invalid credentials');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (loginError) {
      setError('Failed to login');
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
        <a
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
        </a>

        <h1
          style={{
            margin: '0 0 0.7rem',
            fontSize: '1.1rem',
            fontWeight: 700,
            letterSpacing: '-0.01em'
          }}
        >
          {title}
        </h1>

        <p style={{ margin: '0 0 1rem', color: 'rgba(var(--c-text-ch),0.65)', fontSize: '0.8rem' }}>
          {hasInvite
            ? 'This invite link can only be used once and expires automatically.'
            : 'Login with your Plus account to unlock Plus features.'}
        </p>

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
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

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
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

          {hasInvite && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
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
          )}

          {error && (
            <div style={{ fontSize: '0.78rem', color: 'var(--c-accent-error)' }}>{error}</div>
          )}

          {success && (
            <div style={{ fontSize: '0.78rem', color: 'var(--c-accent-mint)' }}>{success}</div>
          )}

          <button
            onClick={hasInvite ? handleRegister : handleLogin}
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
            {loading ? 'Please wait...' : hasInvite ? 'Create account' : 'Login'}
          </button>
        </div>
      </section>
    </main>
  );
}
