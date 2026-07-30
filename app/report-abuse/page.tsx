'use client';

import { useState } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'illegal-content', label: 'Illegal content' },
  { value: 'csam', label: 'Child sexual abuse material (CSAM)' },
  { value: 'malware', label: 'Malware / ransomware' },
  { value: 'copyright', label: 'Copyright infringement (use DMCA instead)' },
  { value: 'phishing-scam', label: 'Phishing / scam' },
  { value: 'other', label: 'Other violation' },
];

export default function ReportAbusePage() {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isCopyright = category === 'copyright';

  const submit = async () => {
    setError('');
    if (!url.trim()) return setError('Please provide the Relay link to the content.');
    if (!category) return setError('Please select a category.');
    if (!description.trim()) return setError('Please describe the issue.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/report-abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), category, description: description.trim(), reporterEmail: reporterEmail.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to submit report');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.05)',
    color: '#f5f5f5',
    fontSize: '0.85rem',
    outline: 'none',
    fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: '0.78rem', color: 'rgba(245,245,245,0.7)', marginBottom: '0.4rem', display: 'block' };

  return (
    <main style={{
      minHeight: '100vh',
      padding: '6rem 6vw 4rem',
      background: 'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
      backgroundAttachment: 'fixed',
      color: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <section style={{
        width: 'min(640px, 92vw)',
        borderRadius: '28px',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        background: 'rgba(255, 255, 255, 0.04)',
        padding: '3rem',
        boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45)'
      }}>
        <div style={{ fontSize: '0.8rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245, 245, 245, 0.55)' }}>
          Trust &amp; Safety
        </div>
        <h1 style={{ margin: '0.9rem 0 0.6rem', fontSize: 'clamp(1.7rem, 3.5vw, 2.3rem)', letterSpacing: '-0.02em' }}>
          Report abuse
        </h1>
        <p style={{ margin: 0, color: 'rgba(245, 245, 245, 0.7)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Use this form to report content on Relay that violates our{' '}
          <Link href="/acceptable-use" style={{ color: '#7ef4cb' }}>Acceptable Use Policy</Link> — illegal
          content, malware, CSAM, or phishing/scam content. For copyright claims, use our{' '}
          <Link href="/dmca" style={{ color: '#7ef4cb' }}>DMCA process</Link> instead.
        </p>

        {submitted ? (
          <div style={{ marginTop: '2rem', padding: '1.2rem', borderRadius: '14px', border: '1px solid rgba(126,244,203,0.3)', background: 'rgba(126,244,203,0.08)' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#7ef4cb' }}>Report submitted</p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'rgba(245,245,245,0.75)' }}>
              Thanks for the report. We&apos;ve logged it and it will be reviewed.
              {' '}If this involves CSAM, please also report it directly to NCMEC at{' '}
              <a href="https://report.cybertip.org" target="_blank" rel="noreferrer" style={{ color: '#7ef4cb' }}>report.cybertip.org</a>.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Link to the content on Relay *</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://relay.xstlo.com/d/..."
                disabled={submitting}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting} style={inputStyle}>
                <option value="">Select a category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {isCopyright && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#f2c879' }}>
                  Copyright claims need specific legal information — please use the{' '}
                  <Link href="/dmca" style={{ color: '#7ef4cb' }}>DMCA takedown process</Link> instead of this form.
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you found and why it violates our policy."
                rows={4}
                disabled={submitting}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Your email (optional, for follow-up)</label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                style={inputStyle}
              />
            </div>

            {error && <p style={{ margin: 0, color: '#ff9e9e', fontSize: '0.82rem' }}>{error}</p>}

            <button
              onClick={submit}
              disabled={submitting}
              style={{
                padding: '0.75rem 1rem', borderRadius: '999px', border: 'none', cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1, background: '#7ef4cb', color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        )}

        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              padding: '0.7rem 1.2rem', borderRadius: '999px', background: 'rgba(233,236,242,0.18)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(233,236,242,0.35)',
              color: '#eef1f6', textDecoration: 'none', fontWeight: 700, boxShadow: '0 2px 12px rgba(0,0,0,0.25)'
            }}
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
