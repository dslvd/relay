'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const POLICY_LINKS = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/acceptable-use', label: 'Acceptable Use' },
  { href: '/dmca', label: 'DMCA' },
  { href: '/report-abuse', label: 'Report Abuse' },
];

export default function PolicyMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'fixed', bottom: '1rem', left: '1rem', zIndex: 50 }}>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 0.5rem)',
            left: 0,
            minWidth: '180px',
            borderRadius: '12px',
            border: '1px solid var(--border-default)',
            background: 'var(--surface-card-strong)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            padding: '0.4rem',
            display: 'grid',
            gap: '0.15rem',
          }}
        >
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{
                padding: '0.5rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                color: 'var(--c-sub)',
                textDecoration: 'none',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-sub)'; }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="footer-link"
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          position: 'static',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
      >
        Policy
        <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s ease' }}>
          <path d="M5 8L1 2H9Z" />
        </svg>
      </button>
    </div>
  );
}
