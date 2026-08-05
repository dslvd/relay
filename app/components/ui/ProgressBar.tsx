interface ProgressBarProps {
  value?: number;
}

/** Thin gradient progress bar used for per-item and overall upload progress. */
export default function ProgressBar({ value = 0 }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        height: 4,
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
        background: 'var(--surface-well)',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 'inherit',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #eef1f6 0%, #7ef4cb 100%)',
          transition: 'width 0.18s ease-out',
        }}
      />
    </div>
  );
}
