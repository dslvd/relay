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
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('admin_authenticated', 'true');
        router.push('/admin/dashboard');
      } else {
        setError('Access denied');
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
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(80% 80% at 50% 20%, rgba(255, 255, 255, 0.06), transparent 70%), radial-gradient(45% 60% at 10% 100%, rgba(255, 255, 255, 0.04), transparent 72%), #0a0a0a',
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem',
      }}
    >
      <style>{`
        @keyframes pulseAlarm {
          0% { opacity: 0.3; }
          50% { opacity: 0.75; }
          100% { opacity: 0.3; }
        }

        @keyframes drift {
          0% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-2%, 1%, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0px, rgba(255, 255, 255, 0.035) 2px, transparent 2px, transparent 18px)',
          mixBlendMode: 'screen',
          opacity: 0.12,
          animation: 'drift 12s ease-in-out infinite',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #ff4d4f, transparent)',
          boxShadow: '0 0 16px rgba(255, 77, 79, 0.75)',
          animation: 'pulseAlarm 1.6s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <section
        style={{
          width: 'min(470px, 92vw)',
          borderRadius: '18px',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #2a2a2a, #ff4d4f, #2a2a2a)',
          }}
        />

        <div style={{ padding: '2rem 1.8rem 1.7rem' }}>
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(245, 245, 245, 0.58)',
              marginBottom: '0.8rem',
              fontFamily: "'Open Sans', sans-serif",
            }}
          >
            Restricted Control Panel
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '1.55rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: '#f5f5f5',
              fontFamily: "'Open Sans', sans-serif",
            }}
          >
            Unauthorized Access Triggers Logging
          </h1>

          <p
            style={{
              marginTop: '0.65rem',
              marginBottom: '1.3rem',
              color: 'rgba(245, 245, 245, 0.62)',
              fontSize: '0.9rem',
              lineHeight: 1.45,
              fontFamily: "'Open Sans', sans-serif",
            }}
          >
            This endpoint is actively monitored. Proceed only if you are the owner.
          </p>

          <div
            style={{
              border: '1px dashed rgba(255, 77, 79, 0.65)',
              borderRadius: '10px',
              padding: '0.55rem 0.75rem',
              marginBottom: '1rem',
              background: 'rgba(255, 77, 79, 0.08)',
              color: '#ffd8d8',
              fontSize: '0.77rem',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              fontFamily: "'Open Sans', sans-serif",
            }}
          >
            Warning: failed attempts are recorded with source IP and timestamp
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              style={{
                width: '100%',
                padding: '0.95rem 1rem',
                borderRadius: '11px',
                border: error
                  ? '1px solid rgba(255, 77, 79, 0.9)'
                  : '1px solid rgba(255, 255, 255, 0.22)',
                background: 'rgba(0, 0, 0, 0.45)',
                color: '#f5f5f5',
                fontSize: '0.97rem',
                outline: 'none',
                marginBottom: '0.85rem',
                fontFamily: "'Open Sans', sans-serif",
              }}
              autoFocus
            />

            {error && (
              <p
                style={{
                  margin: '0 0 0.85rem',
                  color: '#ff8f8f',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  fontFamily: "'Open Sans', sans-serif",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.95rem',
                borderRadius: '11px',
                border: '1px solid rgba(255, 255, 255, 0.24)',
                background: loading
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.07))',
                color: '#f5f5f5',
                fontSize: '0.92rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Open Sans', sans-serif",
              }}
            >
              {loading ? 'Verifying clearance...' : 'Request access'}
            </button>
          </form>

          <p
            style={{
              marginTop: '1rem',
              marginBottom: 0,
              color: 'rgba(245, 245, 245, 0.42)',
              fontSize: '0.76rem',
              lineHeight: 1.4,
              fontFamily: "'Open Sans', sans-serif",
            }}
          >
            By continuing, you acknowledge this area is private infrastructure.
          </p>
        </div>
      </section>
    </div>
  );
}
