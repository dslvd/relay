'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import {
  PLUS_PRICE_PHP_CENTAVOS,
  PLUS_MAX_FILE_BYTES,
  PLUS_STORAGE_LIMIT_BYTES,
  FREE_MAX_FILE_BYTES,
  FREE_STORAGE_LIMIT_BYTES,
  PLUS_CHECKOUT_ENABLED,
  PLUS_CHECKOUT_CONTACT_EMAIL,
} from '@/app/lib/plan-limits';

function formatGb(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${Math.round(gb)}GB` : `${Math.round(bytes / (1024 * 1024))}MB`;
}

const priceDisplay = `₱${(PLUS_PRICE_PHP_CENTAVOS / 100).toFixed(0)}`;
const freeFileLabel = formatGb(FREE_MAX_FILE_BYTES);
const plusFileLabel = formatGb(PLUS_MAX_FILE_BYTES);
const freeStorageLabel = formatGb(FREE_STORAGE_LIMIT_BYTES);
const plusStorageLabel = formatGb(PLUS_STORAGE_LIMIT_BYTES);

// Real ratios, not a stylized guess - the two meters have very different
// free/Plus gaps (12.5% vs 2.5%) so each gets its own fill width. Floored at
// 4% so the free side never disappears into a hairline sliver.
const freeFilePct = Math.max(4, (FREE_MAX_FILE_BYTES / PLUS_MAX_FILE_BYTES) * 100);
const freeStoragePct = Math.max(4, (FREE_STORAGE_LIMIT_BYTES / PLUS_STORAGE_LIMIT_BYTES) * 100);

// Real, code-verified differences only - folders and the 15-day retention
// window are identical on both tiers today, so they're deliberately left off.
const COMPARISON_ROWS: Array<{ label: string; free: string; plus: string }> = [
  { label: 'Per-file upload limit', free: freeFileLabel, plus: plusFileLabel },
  { label: 'Account & vault dashboard', free: '—', plus: 'Included' },
  { label: 'Storage', free: `${freeStorageLabel} total`, plus: `${plusStorageLabel} vault` },
  { label: 'Developer API access', free: '—', plus: 'Included' },
  { label: 'Code snippet sharing', free: 'Included', plus: 'Included' },
  { label: 'Ads', free: 'Shown', plus: 'None' },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from the link in your receipt email whenever you want - no minimum term, no retention calls.',
  },
  {
    q: 'What happens to files I already uploaded for free?',
    a: 'Nothing changes. Plus adds an 80GB account vault on top; your existing public links keep working exactly as they do today.',
  },
  {
    q: 'Is my payment information safe?',
    a: 'Checkout and billing run entirely through Lemon Squeezy. Relay never sees or stores your card details.',
  },
  {
    q: 'What payment methods can I use?',
    a: "Cards and anything else Lemon Squeezy offers at checkout - you'll see the exact options on the payment page.",
  },
];

export default function PricingPage() {
  const [checkingPlus, setCheckingPlus] = useState(true);
  const [isPlus, setIsPlus] = useState(false);
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [metersIn, setMetersIn] = useState(false);

  useEffect(() => {
    fetch('/api/plus/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setIsPlus(Boolean(data?.plus)))
      .catch(() => setIsPlus(false))
      .finally(() => setCheckingPlus(false));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setMetersIn(true), 120);
    return () => window.clearTimeout(id);
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
    <>
      <style jsx>{`
        .meterTrack {
          height: 10px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.06);
        }
        [data-theme='light'] .meterTrack {
          background: rgba(0, 0, 0, 0.07);
        }
        .meterFill {
          height: 100%;
          border-radius: inherit;
          width: 0%;
          transition: width 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .meterFill--free {
          background: rgba(var(--c-dim-ch), 0.55);
        }
        .meterFill--plus {
          background: linear-gradient(90deg, #eef1f6 0%, #7ef4cb 100%);
        }
        .meterFill.in.plus {
          width: 100%;
        }
        .faqItem summary {
          cursor: pointer;
          list-style: none;
        }
        .faqItem summary::-webkit-details-marker {
          display: none;
        }
        .faqChevron {
          transition: transform 0.2s ease;
        }
        .faqItem[open] .faqChevron {
          transform: rotate(45deg);
        }
        .cmpRow:last-child {
          border-bottom: none !important;
        }
        .pageHeader {
          padding-right: 0;
        }
        .heroGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.6rem;
          align-items: start;
        }
        .meterCard {
          display: grid;
          gap: 1.1rem;
          grid-template-columns: 1fr;
        }
        .priceCard {
          position: relative;
        }
        @media (max-width: 480px) {
          .pageHeader {
            padding-right: 2.75rem;
          }
        }
        @media (min-width: 900px) {
          .heroGrid {
            grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
            gap: 2rem;
          }
          .meterCard {
            grid-template-columns: 1fr 1fr;
          }
          .priceCard {
            position: sticky;
            top: 2rem;
          }
        }
        @media (max-width: 560px) {
          .cmpTable {
            grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) !important;
            font-size: 0.72rem !important;
            padding-left: 0.8rem !important;
            padding-right: 0.8rem !important;
          }
        }
      `}</style>

      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          padding: 'clamp(2rem, 6vw, 4.5rem) 1.2rem 4rem',
          background:
            'radial-gradient(ellipse at 30% 0%, var(--wash-violet) 0%, var(--wash-base) 55%), radial-gradient(ellipse at 80% 60%, var(--wash-teal) 0%, var(--wash-base) 60%)',
          backgroundAttachment: 'fixed',
          color: 'var(--c-text)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '1040px', minWidth: 0 }}>
          {/* Header */}
          <div
            className="pageHeader"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2.4rem',
              animation: 'heroReveal 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', textDecoration: 'none' }}>
              <Image src={logo} alt="" width={22} height={22} style={{ opacity: 0.92 }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-text)' }}>Relay</span>
            </Link>
            <Link href="/plus" style={{ fontSize: '0.78rem', color: 'var(--c-sub)', textDecoration: 'none', flexShrink: 0 }}>
              Log in
            </Link>
          </div>

          {/* Hero row: value prop + capacity meters on the left, price/CTA on
              the right on desktop (>=900px) so the page uses the extra width
              instead of leaving both gutters empty; stacks on mobile. */}
          <div className="heroGrid" style={{ marginBottom: '2.2rem' }}>
            <div>
              {/* Hero */}
              <div style={{ marginBottom: '1.6rem', animation: 'heroReveal 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both' }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 'clamp(1.9rem, 4.4vw, 2.6rem)',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.15,
                  }}
                >
                  Stop hitting the {freeFileLabel} wall.
                </h1>
                <p style={{ margin: '0.7rem 0 0', color: 'var(--c-sub)', fontSize: '0.95rem', maxWidth: '46ch' }}>
                  Relay Plus raises your per-file limit to{' '}
                  <strong style={{ color: 'var(--c-text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{plusFileLabel}</strong>{' '}
                  and gives you an{' '}
                  <strong style={{ color: 'var(--c-text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{plusStorageLabel}</strong>{' '}
                  account vault you can reach from any device.
                </p>
              </div>

              {/* Signature element: capacity meters, styled like Relay's real upload progress bar */}
              <div
                className="meterCard"
                style={{
                  ...card,
                  borderRadius: '18px',
                  padding: '1.4rem 1.5rem',
                  animation: 'heroReveal 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.16s both',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)', marginBottom: '0.5rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Per-file upload limit
                  </div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <div className="meterTrack">
                      <div
                        className={`meterFill meterFill--free ${metersIn ? 'in' : ''}`}
                        style={{ width: metersIn ? `${freeFilePct}%` : 0 }}
                      />
                    </div>
                    <div className="meterTrack">
                      <div className={`meterFill meterFill--plus ${metersIn ? 'in plus' : ''}`} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--c-dim)' }}>Free · {freeFileLabel}</span>
                    <span style={{ color: 'var(--c-accent-mint)', fontWeight: 700 }}>Plus · {plusFileLabel}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--c-dim)', marginBottom: '0.5rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Account storage
                  </div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <div className="meterTrack">
                      <div
                        className={`meterFill meterFill--free ${metersIn ? 'in' : ''}`}
                        style={{ width: metersIn ? `${freeStoragePct}%` : 0 }}
                      />
                    </div>
                    <div className="meterTrack">
                      <div className={`meterFill meterFill--plus ${metersIn ? 'in plus' : ''}`} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--c-dim)' }}>Free · {freeStorageLabel} total</span>
                    <span style={{ color: 'var(--c-accent-mint)', fontWeight: 700 }}>Plus · {plusStorageLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price + CTA */}
            <div
              className="priceCard"
              style={{
                ...card,
                borderRadius: '20px',
                padding: '1.8rem',
                boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                animation: 'heroReveal 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.24s both',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: 'rgba(126,244,203,0.14)',
                  color: 'var(--c-accent-mint)',
                  marginBottom: '0.9rem',
                }}
              >
                Relay Plus
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '2.6rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                  {priceDisplay}
                </span>
                <span style={{ color: 'var(--c-dim)', fontSize: '0.9rem' }}>/month · PHP</span>
              </div>
              <p style={{ margin: '0 0 1.5rem', color: 'var(--c-dim)', fontSize: '0.78rem' }}>Cancel anytime. No minimum term.</p>

              {checkingPlus ? null : isPlus ? (
                <a
                  href="/plus/dashboard"
                  style={{
                    display: 'block', textAlign: 'center', padding: '0.8rem 1rem', borderRadius: '999px',
                    background: 'var(--c-accent-mint)', color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem',
                    textDecoration: 'none',
                  }}
                >
                  You&apos;re already on Plus — go to your vault
                </a>
              ) : !PLUS_CHECKOUT_ENABLED ? (
                <div
                  style={{
                    padding: '0.9rem 1rem', borderRadius: '14px', textAlign: 'center',
                    border: '1px solid var(--border-default)', background: 'var(--surface-well)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Checkout is under construction</p>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--c-sub)' }}>
                    Please contact{' '}
                    <a href={`mailto:${PLUS_CHECKOUT_CONTACT_EMAIL}`} style={{ color: 'var(--c-accent-mint)' }}>
                      {PLUS_CHECKOUT_CONTACT_EMAIL}
                    </a>{' '}
                    for early access.
                  </p>
                </div>
              ) : !showEmailStep ? (
                <button
                  onClick={() => setShowEmailStep(true)}
                  style={{
                    width: '100%', padding: '0.8rem 1rem', borderRadius: '999px', border: 'none', cursor: 'pointer',
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

              <p style={{ margin: '1rem 0 0', textAlign: 'center', fontSize: '0.7rem', color: 'var(--c-dim)' }}>
                Secure checkout via Lemon Squeezy · Relay never sees your card details
              </p>
            </div>
          </div>

          {/* Comparison table + FAQ stay in a narrower reading column even on
              desktop - a full 1040px-wide table/FAQ list would be harder to
              scan than the two-column hero row above it. */}
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2.2rem' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: '0.8rem' }}>
                What&apos;s included
              </h2>
              <div style={{ ...card, borderRadius: '16px', overflow: 'hidden' }}>
                <div
                  className="cmpTable"
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)', padding: '0.7rem 1.1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--c-dim)', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <span />
                  <span>Free</span>
                  <span style={{ color: 'var(--c-accent-mint)' }}>Plus</span>
                </div>
                {COMPARISON_ROWS.map((row) => (
                  <div
                    key={row.label}
                    className="cmpRow cmpTable"
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)', padding: '0.75rem 1.1rem', fontSize: '0.82rem', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}
                  >
                    <span style={{ color: 'var(--c-text)' }}>{row.label}</span>
                    <span style={{ color: 'var(--c-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{row.free}</span>
                    <span style={{ color: 'var(--c-text)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{row.plus}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div style={{ marginBottom: '2.2rem' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: '0.8rem' }}>
                Questions
              </h2>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {FAQ.map((item) => (
                  <details key={item.q} className="faqItem" style={{ ...card, borderRadius: '14px', padding: '0.9rem 1.1rem' }}>
                    <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--c-text)' }}>
                      {item.q}
                      <span className="faqChevron" style={{ color: 'var(--c-dim)', fontSize: '0.9rem' }}>+</span>
                    </summary>
                    <p style={{ margin: '0.7rem 0 0', fontSize: '0.82rem', color: 'var(--c-sub)', lineHeight: 1.55 }}>{item.a}</p>
                  </details>
                ))}
              </div>
            </div>

            <p style={{ color: 'var(--c-dim)', fontSize: '0.75rem', textAlign: 'center' }}>
              Already subscribed? <Link href="/plus" style={{ color: 'var(--c-sub)' }}>Log in here</Link>.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
