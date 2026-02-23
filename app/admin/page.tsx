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
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('admin_authenticated', 'true');
        router.push('/admin/dashboard');
      } else {
        setError('Invalid password');
        setPassword('');
      }
    } catch (error) {
      setError('Authentication failed');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      padding: '2rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '18px',
        padding: '3rem',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)'
      }}>
        <h1 style={{
          fontFamily: "'Open Sans', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 300,
          color: '#f5f5f5',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          🔐 Admin Login
        </h1>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{
              width: '100%',
              padding: '0.85rem',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '10px',
              color: '#f5f5f5',
              fontSize: '0.8rem',
              marginBottom: '1rem',
              outline: 'none',
              fontFamily: 'inherit'
            }}
            autoFocus
          />

          {error && (
            <p style={{
              color: '#f5f5f5',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              textAlign: 'center',
              opacity: 0.7
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.9rem',
              background: loading ? '#e6e6e6' : '#ffffff',
              border: '1px solid #ffffff',
              borderRadius: '10px',
              color: '#0a0a0a',
              fontSize: '0.8rem',
              fontWeight: 400,
              letterSpacing: '0.02em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, background 0.2s',
              fontFamily: "'Open Sans', sans-serif"
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.background = '#e6e6e6';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            {loading ? 'Checking...' : 'Login'}
          </button>
        </form>

        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: '#666666',
          textAlign: 'center'
        }}>
          <br />
        </p>
      </div>
    </div>
  );
}
