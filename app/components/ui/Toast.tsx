type ToastType = 'success' | 'error' | 'info';

const TONE: Record<ToastType, { color: string }> = {
  success: { color: '#7ef4cb' },
  error: { color: '#ff9e9e' },
  info: { color: '#eef1f6' },
};

interface ToastProps {
  message: string;
  type?: ToastType;
}

/** Bottom/corner toast used for transient confirmations ("Link copied!", "Upload cancelled"). */
export default function Toast({ message, type = 'info' }: ToastProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.65rem 1rem',
        borderRadius: 'var(--radius-2xl)',
        background: 'var(--surface-card-strong)',
        border: '1px solid var(--border-default)',
        backdropFilter: 'blur(var(--blur-xl))',
        WebkitBackdropFilter: 'blur(var(--blur-xl))',
        boxShadow: 'var(--shadow-card-lg)',
        color: TONE[type].color,
        fontFamily: 'var(--font-body)',
        fontSize: '0.8rem',
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  );
}
