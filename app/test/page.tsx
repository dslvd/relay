import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Relay — /test',
  description: 'Design experiment.',
  robots: { index: false, follow: false },
};

const TERMINAL_LINES = [
  { text: '$ relay push ./design-review.fig', delay: 0 },
  { text: '✓ uploaded — 8.2mb in 0.6s', delay: 2.2 },
  { text: '→ relay.xstlo.com/d/x7k2p9', delay: 3.6 },
];

const MANIFEST = [
  { k: 'free_tier_limit', v: '100mb / file' },
  { k: 'plus_tier_limit', v: '8gb / file' },
  { k: 'plus_vault', v: '80gb total' },
  { k: 'retention', v: '15d idle → gone' },
  { k: 'signup_required', v: 'false' },
];

export default function TestHomepage() {
  return (
    <main className="tpage">
      <style>{`
        .tpage {
          min-height: 100vh;
          background: #000;
          color: #fff;
          font-family: var(--font-mono), ui-monospace, monospace;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: clamp(2rem, 6vw, 5rem) 1.5rem 3rem;
        }
        .tpage a { color: #fff; }
        .t-wrap { width: 100%; max-width: 680px; }

        .t-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: clamp(3rem, 10vw, 6rem);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .t-nav .mark { display: flex; align-items: center; gap: 0.5rem; }
        .t-diamond {
          width: 9px; height: 9px;
          border: 1px solid #fff;
          transform: rotate(45deg);
          flex-shrink: 0;
        }
        .t-nav a { text-decoration: none; opacity: 0.55; transition: opacity 0.15s ease; }
        .t-nav a:hover { opacity: 1; }

        .t-h1 {
          font-size: clamp(1.5rem, 4.5vw, 2.1rem);
          line-height: 1.35;
          font-weight: 400;
          margin: 0 0 0.9rem;
          letter-spacing: -0.01em;
        }
        .t-h1 .dim { color: #666; }
        .t-sub {
          font-size: 0.82rem;
          color: #888;
          line-height: 1.6;
          margin: 0 0 2.4rem;
          max-width: 52ch;
        }

        .t-term {
          border: 1px solid rgba(255,255,255,0.18);
          background: #050505;
          margin-bottom: 2.4rem;
        }
        .t-term-bar {
          display: flex;
          gap: 0.4rem;
          padding: 0.65rem 0.8rem;
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }
        .t-term-dot {
          width: 8px; height: 8px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.4);
        }
        .t-term-body {
          padding: 1.1rem 1.2rem 1.4rem;
          font-size: 0.78rem;
          line-height: 1.9;
          min-height: 5.7rem;
        }
        .t-line {
          white-space: nowrap;
          overflow: hidden;
          width: 0;
          border-right: 2px solid #fff;
          animation: t-type 1.1s steps(30, end) forwards;
        }
        .t-line--out { color: #888; }
        .t-line--link { color: #fff; }
        /* Only the last line keeps a blinking cursor once typing finishes -
           all three blinking forever read as three unrelated cursors instead
           of one command that finished running. */
        .t-line--cursor { animation-name: t-type, t-caret; animation-iteration-count: 1, infinite; }
        @keyframes t-type { to { width: 100%; } }
        @keyframes t-caret { 50% { border-color: transparent; } }
        @media (prefers-reduced-motion: reduce) {
          .t-line { animation: none; width: auto; border-right: none; }
        }

        .t-manifest {
          border-top: 1px solid rgba(255,255,255,0.15);
          border-bottom: 1px solid rgba(255,255,255,0.15);
          padding: 1.1rem 0;
          margin-bottom: 2.4rem;
          font-size: 0.74rem;
        }
        .t-manifest-row {
          display: flex;
          justify-content: space-between;
          padding: 0.32rem 0;
          color: #999;
        }
        .t-manifest-row b { color: #fff; font-weight: 400; }

        .t-cta {
          display: flex;
          gap: 0.7rem;
          flex-wrap: wrap;
          margin-bottom: 3.5rem;
        }
        .t-btn {
          display: inline-block;
          padding: 0.7rem 1.1rem;
          font-size: 0.76rem;
          text-decoration: none;
          border: 1px solid #fff;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .tpage a.t-btn--solid { background: #fff; color: #000; }
        .tpage a.t-btn--solid:hover { background: #ccc; }
        .t-btn--outline { color: #fff; }
        .t-btn--outline:hover { background: #fff; color: #000; }

        .t-foot {
          font-size: 0.68rem;
          color: #555;
          letter-spacing: 0.04em;
        }
      `}</style>

      <div className="t-wrap">
        <nav className="t-nav">
          <span className="mark">
            <span className="t-diamond" />
            relay
          </span>
          <Link href="/">exit experiment →</Link>
        </nav>

        <h1 className="t-h1">
          Share a file.<br />
          Get a link.<br />
          <span className="dim">Nothing else.</span>
        </h1>
        <p className="t-sub">
          No account, no dashboard tour, no upsell before you&apos;ve uploaded a single byte.
          Relay in the form it was probably meant to take.
        </p>

        <div className="t-term">
          <div className="t-term-bar">
            <span className="t-term-dot" />
            <span className="t-term-dot" />
            <span className="t-term-dot" />
          </div>
          <div className="t-term-body">
            {TERMINAL_LINES.map((line, i) => (
              <div
                key={line.text}
                className={`t-line ${i === 1 ? 't-line--out' : i === 2 ? 't-line--link' : ''}`}
                style={{ animationDelay: `${line.delay}s, ${line.delay}s` }}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>

        <div className="t-manifest">
          {MANIFEST.map((row) => (
            <div className="t-manifest-row" key={row.k}>
              <span>{row.k}</span>
              <b>{row.v}</b>
            </div>
          ))}
        </div>

        <div className="t-cta">
          <Link href="/" className="t-btn t-btn--solid">Upload a file →</Link>
          <Link href="/pricing" className="t-btn t-btn--outline">See pricing</Link>
        </div>

        <div className="t-foot">
          design experiment — relay.xstlo.com/test — not the real homepage
        </div>
      </div>
    </main>
  );
}
