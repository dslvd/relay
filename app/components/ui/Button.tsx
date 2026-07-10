'use client';

import { CSSProperties, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'accent' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

const SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '0.5rem 0.9rem', fontSize: '0.75rem' },
  md: { padding: '0.7rem 1.4rem', fontSize: '0.85rem' },
};

/**
 * Pill/glass action button. `variant="primary"` is the neutral frosted-glass
 * pill used for Login/CTA-style actions; `variant="accent"` is the mint
 * download-button treatment (rounded-10px, not a full pill — color signals
 * "the one thing to do on this screen"); `variant="ghost"` is the quiet
 * secondary chip used for Copy link / Preview / QR / Embed rows.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  active = false,
  disabled = false,
  children,
  onClick,
  style,
  type = 'button',
}: ButtonProps) {
  const base: CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    border: '1px solid transparent',
    transition: 'background 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    opacity: disabled ? 0.5 : 1,
  };

  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      borderRadius: 'var(--radius-pill)',
      background: 'var(--btn-primary-bg)',
      borderColor: 'var(--btn-primary-border)',
      color: 'var(--btn-primary-fg)',
      backdropFilter: 'blur(var(--blur-lg))',
      WebkitBackdropFilter: 'blur(var(--blur-lg))',
      boxShadow: 'var(--shadow-btn), var(--shadow-inset-hairline)',
    },
    accent: {
      borderRadius: 'var(--radius-lg)',
      background: 'var(--btn-download-bg)',
      borderColor: 'var(--btn-download-border)',
      color: 'var(--btn-download-fg)',
      fontWeight: 700,
    },
    ghost: {
      borderRadius: 'var(--radius-md)',
      background: active ? 'var(--surface-hover)' : 'var(--surface-well)',
      borderColor: active ? 'var(--border-default)' : 'var(--border-subtle)',
      color: 'var(--c-text)',
      fontWeight: 600,
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...SIZES[size], ...variants[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === 'accent') {
          e.currentTarget.style.background = 'var(--btn-download-bg-hover)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        } else if (variant === 'ghost') {
          e.currentTarget.style.background = 'var(--surface-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        if (variant === 'accent') {
          e.currentTarget.style.background = 'var(--btn-download-bg)';
          e.currentTarget.style.transform = 'translateY(0)';
        } else if (variant === 'ghost') {
          e.currentTarget.style.background = active ? 'var(--surface-hover)' : 'var(--surface-well)';
        }
      }}
    >
      {children}
    </button>
  );
}
