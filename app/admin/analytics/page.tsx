'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SeriesPoint = { ts: number; downloads: number; bytes: number; pageViews: number };

type AnalyticsDetail = {
  pageViews: { total: number; last24h: number; last7days: number };
  visitors: { unique: number; unique24h: number; live: number };
  downloads: { total: number; last24h: number; last7days: number };
  bandwidth?: { totalBytes: number; last24h: number; last7days: number };
  topFiles: Array<{ filename: string; totalDownloads: number; last24h: number; last7days: number; uniqueUsers: number }>;
  topReferrers?: Array<{ referer: string; count: number }>;
  topCountries?: Array<{ country: string; count: number }>;
  series?: SeriesPoint[] | null;
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${Math.round(val * 100) / 100} ${sizes[i]}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchIt = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/analytics?detail=1', { cache: 'no-store', credentials: 'include' });
        const payload = await res.json().catch(() => null);
        if (res.status === 401) {
          sessionStorage.removeItem('admin_authenticated');
          router.push('/admin');
          return;
        }
        if (res.ok && payload) setData(payload as AnalyticsDetail);
      } finally {
        setLoading(false);
      }
    };

    fetchIt();
    const id = window.setInterval(fetchIt, 30000);
    return () => window.clearInterval(id);
  }, [router]);

  const chart = useMemo(() => {
    const series = data?.series || [];
    if (!series || series.length < 2) return null;

    const w = 820;
    const h = 160;
    const padX = 16;
    const padY = 12;
    const max = Math.max(1, ...series.map((p) => p.downloads));

    const pts = series.map((p, idx) => {
      const x = padX + (idx / (series.length - 1)) * (w - padX * 2);
      const y = padY + (1 - p.downloads / max) * (h - padY * 2);
      return `${x},${y}`;
    });

    return {
      w,
      h,
      pts: pts.join(' '),
      labels: [series[0]?.ts, series[series.length - 1]?.ts].filter(Boolean) as number[],
      max,
    };
  }, [data]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', padding: '3rem 6vw', color: '#eef1f6' }}>
        Loading analytics…
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ minHeight: '100vh', padding: '3rem 6vw', color: '#eef1f6' }}>
        Failed to load analytics.
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '3rem 6vw 4rem',
        background:
          'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
        backgroundAttachment: 'fixed',
        color: '#eef1f6',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>Analytics</h1>
          <a
            href="/admin/dashboard"
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: '#eef1f6',
              textDecoration: 'none',
              fontSize: '0.8rem',
            }}
          >
            Back to dashboard
          </a>
        </div>

        <div
          style={{
            marginTop: '1.1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.8rem',
          }}
        >
          {[
            { label: 'Page Views (24h)', value: data.pageViews.last24h.toLocaleString() },
            { label: 'Downloads (24h)', value: data.downloads.last24h.toLocaleString() },
            { label: 'Live Visitors', value: data.visitors.live.toLocaleString() },
            { label: 'Bandwidth (24h)', value: formatBytes(data.bandwidth?.last24h || 0) },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
                padding: '0.9rem 1rem',
                boxShadow: '0 10px 36px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,245,0.55)' }}>
                {card.label}
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '1.1rem', fontWeight: 700 }}>{card.value}</div>
            </div>
          ))}
        </div>

        {chart && (
          <section
            style={{
              marginTop: '1.2rem',
              borderRadius: '18px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(18px)',
              padding: '1rem',
              boxShadow: '0 18px 54px rgba(0,0,0,0.38)',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>Downloads (last 24h)</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(245,245,245,0.55)' }}>
                Max/hour: {chart.max}
              </div>
            </div>
            <svg width={chart.w} height={chart.h} viewBox={`0 0 ${chart.w} ${chart.h}`} style={{ marginTop: '0.7rem', width: '100%', height: 'auto' }}>
              <defs>
                <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="rgba(233,236,242,0.55)" />
                  <stop offset="1" stopColor="rgba(233,236,242,0.08)" />
                </linearGradient>
              </defs>
              <polyline points={chart.pts} fill="none" stroke="rgba(233,236,242,0.85)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={`${chart.pts} ${chart.w - 16},${chart.h - 12} 16,${chart.h - 12}`} fill="url(#g)" stroke="none" opacity="0.7" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.7rem', color: 'rgba(245,245,245,0.55)' }}>
              <span>{formatTime(chart.labels[0])}</span>
              <span>{formatTime(chart.labels[1])}</span>
            </div>
          </section>
        )}

        <div style={{ marginTop: '1.2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.9rem' }}>
          <section style={{ borderRadius: '18px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(18px)', padding: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.7rem' }}>Top Referrers</div>
            {(data.topReferrers || []).length === 0 ? (
              <div style={{ color: 'rgba(245,245,245,0.55)', fontSize: '0.85rem' }}>No referrer data yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {(data.topReferrers || []).map((r) => (
                  <div key={r.referer} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ minWidth: 0, wordBreak: 'break-all', fontSize: '0.78rem', color: 'rgba(245,245,245,0.85)' }}>{r.referer}</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(245,245,245,0.65)' }}>{r.count}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ borderRadius: '18px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(18px)', padding: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.7rem' }}>Top Countries</div>
            {(data.topCountries || []).length === 0 ? (
              <div style={{ color: 'rgba(245,245,245,0.55)', fontSize: '0.85rem' }}>No country data yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {(data.topCountries || []).map((c) => (
                  <div key={c.country} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(245,245,245,0.85)' }}>{c.country}</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(245,245,245,0.65)' }}>{c.count}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section style={{ marginTop: '1.2rem', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(18px)', padding: '1rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.7rem' }}>Top Files</div>
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            {data.topFiles.slice(0, 20).map((f) => (
              <div key={f.filename} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
                <div style={{ minWidth: 0, wordBreak: 'break-all', fontSize: '0.78rem', color: 'rgba(245,245,245,0.85)' }}>{f.filename}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(245,245,245,0.65)' }}>{f.totalDownloads}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

