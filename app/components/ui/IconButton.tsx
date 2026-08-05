'use client';

import { CSSProperties, ReactNode } from 'react';

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  size?: number;
  style?: CSSProperties;
}

/** Small circular glass icon-button — used in the queue list (pause/retry/remove) and popovers. */
export default function IconButton({ children, onClick, title, disabled = false, size = 30, style }: IconButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-input)',
        backdropFilter: 'blur(var(--blur-md))',
        WebkitBackdropFilter: 'blur(var(--blur-md))',
        boxShadow: '0 3px 10px rgba(0,0,0,0.16)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--c-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform 0.2s ease, background 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = 'var(--surface-input)';
      }}
    >
      {children}
    </button>
  );
}
