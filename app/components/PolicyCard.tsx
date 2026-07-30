export default function PolicyCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '1.2rem 1.4rem',
      borderRadius: '18px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(255, 255, 255, 0.03)'
    }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
      <div style={{ marginTop: '0.75rem', color: 'rgba(245, 245, 245, 0.72)', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
