'use client';

import { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Glass text/password/email input used across auth and remote-upload forms. */
export default function Input({ type = 'text', style, ...rest }: InputProps) {
  return (
    <input
      type={type}
      style={{
        width: '100%',
        padding: '0.65rem 0.75rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-input)',
        background: 'var(--surface-input)',
        backdropFilter: 'blur(var(--blur-md))',
        WebkitBackdropFilter: 'blur(var(--blur-md))',
        color: 'var(--c-text)',
        fontFamily: 'var(--font-body)',
        fontSize: '0.8rem',
        outline: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        boxSizing: 'border-box',
        ...style,
      }}
      {...rest}
    />
  );
}
