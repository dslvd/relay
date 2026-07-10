import { CSSProperties, ReactNode } from 'react';

type CardWeight = 'card' | 'modal';

interface CardProps {
  weight?: CardWeight;
  style?: CSSProperties;
  children: ReactNode;
}

const WEIGHTS: Record<CardWeight, CSSProperties> = {
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-4xl)',
    backdropFilter: 'blur(var(--blur-xl)) saturate(180%)',
    WebkitBackdropFilter: 'blur(var(--blur-xl)) saturate(180%)',
    boxShadow: 'var(--shadow-card-lg), inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  modal: {
    background: 'var(--surface-card-strong)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-2xl)',
    backdropFilter: 'blur(var(--blur-2xl)) saturate(180%)',
    WebkitBackdropFilter: 'blur(var(--blur-2xl)) saturate(180%)',
    boxShadow: 'var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
};

/**
 * Frosted glass container — the base surface for every panel in the product
 * (auth forms, download-page card, legal page, queue panel). `weight="modal"`
 * is the heavier blur+shadow treatment used for auth/login panels; `weight="card"`
 * is the lighter default used for in-page panels.
 */
export default function Card({ weight = 'card', style, children }: CardProps) {
  return (
    <div style={{ padding: '1.5rem', color: 'var(--c-text)', ...WEIGHTS[weight], ...style }}>
      {children}
    </div>
  );
}
