import { ReactNode } from 'react';

type BadgeStatus = 'queued' | 'uploading' | 'success' | 'error';

interface BadgeSpec {
  bg: string;
  fg: string;
  border: string;
  label: string;
}

const MAP: Record<BadgeStatus, BadgeSpec> = {
  queued: { bg: 'var(--status-queued-bg)', fg: 'var(--status-queued-fg)', border: 'rgba(255,255,255,0.06)', label: 'Queued' },
  uploading: { bg: 'var(--status-uploading-bg)', fg: 'var(--status-uploading-fg)', border: 'transparent', label: 'Uploading' },
  success: { bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)', border: 'var(--status-success-border)', label: 'Success' },
  error: { bg: 'var(--status-error-bg)', fg: 'var(--status-error-fg)', border: 'var(--status-error-border)', label: 'Error' },
};

interface BadgeProps {
  status?: BadgeStatus;
  children?: ReactNode;
}

/** Small uppercase status pill used for upload-queue rows (queued/uploading/success/error). */
export default function Badge({ status = 'queued', children }: BadgeProps) {
  const s = MAP[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.16rem 0.48rem',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.fg,
        fontSize: 'var(--text-2xs)',
        fontWeight: 600,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
      }}
    >
      {children || s.label}
    </span>
  );
}
