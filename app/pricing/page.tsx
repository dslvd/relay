'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLUS_PRICE_PHP_CENTAVOS, PLUS_MAX_FILE_BYTES, PLUS_STORAGE_LIMIT_BYTES } from '@/app/lib/plan-limits';

function formatGb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;
}

const FEATURES = [
  `Upload files up to ${formatGb(PLUS_MAX_FILE_BYTES)} each (vs. 100MB on the free tier)`,
  `${formatGb(PLUS_STORAGE_LIMIT_BYTES)} of vault storage for your account`,
  'Resumable, multipart uploads that survive a refresh',
  'Folders to organize your files',
  'Code snippet sharing with syntax highlighting',
  'QR codes for quick sharing to mobile',
  'No ads',
];

const priceDisplay = `₱${(PLUS_PRICE_PHP_CENTAVOS / 100).toFixed(0)}`;

export default function PricingPage() {
  const [checkingPlus, setCheckingPlus] = useState(true);
  const [isPlus, setIsPlus] = useState(false);
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/plus/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setIsPlus(Boolean(data?.plus)))
      .catch(() => setIsPlus(false))
      .finally(() => setCheckingPlus(false));
  }, []);

  const startCheckout = async () => {
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/lemonsqueezy/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setSubmitting(false);
    }
  };

  const card = {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        padding: 'clamp(1.5rem, 5vw, 4rem) 1.2rem',
        background: 'radial-gradient(ellipse at 30% 20%, var(--wash-violet) 0%, var(--wash-base) 55%), radial-gradient(ellipse at 75% 80%, var(--wash-teal) 0%, var(--wash-base) 60%)',
        backgroundAttachment: 'fixed',
        color: 'var(--c-text)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <Link
          href="/"
          style={{ display: 'inline-block', marginBottom: '2rem', color: 'var(--c-dim)', fontSize: '0.8rem', textDecoration: 'none' }}
        >
          ← Back to Relay
        </Link>

        <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.3rem)' }}>Relay Plus</h1>
        <p style={{ margin: '0.5rem 0 2rem', color: 'var(--c-sub)', fontSize: '0.9rem' }}>
          More storage, bigger uploads, no ads.
        </p>

        <div
          style={{
            ...card,
            borderRadius: '20px',
            padding: '1.8rem',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '1.4rem' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 700 }}>{priceDisplay}</span>
            <span style={{ color: 'var(--c-dim)', fontSize: '0.9rem' }}>/month · PHP</span>
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.65rem' }}>
            {FEATURES.map((feature) => (
              <li key={feature} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--c-sub)' }}>
                <span style={{ color: 'var(--c-accent-mint)', flexShrink: 0 }}>✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: '1.6rem' }}>
            {checkingPlus ? null : isPlus ? (
              <a
                href="/plus/dashboard"
                style={{
                  display: 'block', textAlign: 'center', padding: '0.75rem 1rem', borderRadius: '999px',
                  background: 'var(--c-accent-mint)', color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem',
                  textDecoration: 'none',
                }}
              >
                You&apos;re already on Plus — go to your vault
              </a>
            ) : !showEmailStep ? (
              <button
                onClick={() => setShowEmailStep(true)}
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '999px', border: 'none', cursor: 'pointer',
                  background: 'var(--c-accent-mint)', color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem',
                }}
              >
                Get Relay Plus
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void startCheckout(); }}
                  placeholder="you@example.com"
                  disabled={submitting}
                  style={{
                    padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-input)',
                    background: 'var(--surface-input)', color: 'var(--c-text)', fontSize: '0.85rem', outline: 'none',
                  }}
                />
                <p style={{ margin: 0, color: 'var(--c-dim)', fontSize: '0.72rem' }}>
                  Use the email that should receive your receipt and Plus login link.
                </p>
                {error && <p style={{ margin: 0, color: 'var(--c-accent-error)', fontSize: '0.78rem' }}>{error}</p>}
                <button
                  onClick={startCheckout}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '0.7rem 1rem', borderRadius: '999px', border: 'none',
                    cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
                    background: 'var(--c-accent-mint)', color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem',
                  }}
                >
                  {submitting ? 'Redirecting to checkout…' : 'Continue with email'}
                </button>
              </div>
            )}
          </div>
        </div>

        <p style={{ color: 'var(--c-dim)', fontSize: '0.75rem', textAlign: 'center' }}>
          Already subscribed? <Link href="/plus" style={{ color: 'var(--c-sub)' }}>Log in here</Link>.
        </p>
      </div>
    </main>
  );
}
