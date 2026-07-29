'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'upload files & snippets' },
  { path: '/docs', label: 'API docs' },
  { path: '/api', label: 'developer API dashboard' },
  { path: '/dmca', label: 'DMCA' },
  { path: '/plus', label: 'Plus login' },
  { path: '/plus/forgot', label: 'Plus — forgot password' },
  { path: '/plus/reset', label: 'Plus — reset password' },
  { path: '/plus/dashboard', label: 'Plus vault dashboard' },
  { path: '/admin', label: 'admin login' },
  { path: '/admin/dashboard', label: 'admin dashboard' },
  { path: '/admin/analytics', label: 'admin analytics' },
];

const ROUTE_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: '/d/[key]', label: 'share / download page' },
  { pattern: '/download/[...path]', label: 'legacy download page' },
  { pattern: '/folder/[code]', label: 'shared folder view' },
  { pattern: '/dl/[...path]', label: 'raw file download' },
  { pattern: '/p/[...path]', label: 'CDN passthrough' },
  { pattern: '/s/[code]', label: 'short link redirect' },
  { pattern: '/i/[shortId]', label: 'permanent view link' },
];

const COMMANDS = ['help', 'ls', 'cd', 'curl', 'pwd', 'whoami', 'clear'];

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '3.2em 1fr',
  columnGap: '0.9em',
  lineHeight: 1.7,
};

function RouteDump() {
  return (
    <>
      <div style={{ margin: '0.5rem 0 0.3rem', color: 'var(--c-dim, #8a92a1)', fontStyle: 'italic' }}>
        {'// pages'}
      </div>
      {PAGES.map((p) => (
        <div key={p.path} style={rowStyle}>
          <span style={{ color: '#b9a6ff' }}>GET</span>
          <span>
            <Link href={p.path} className="nf-route-link">{p.path}</Link>
            <span style={{ color: 'var(--c-dim, #8a92a1)' }}>{'  // ' + p.label}</span>
          </span>
        </div>
      ))}

      <div style={{ margin: '0.9rem 0 0.3rem', color: 'var(--c-dim, #8a92a1)', fontStyle: 'italic' }}>
        {'// file & content routes — dynamic, need real params'}
      </div>
      {ROUTE_PATTERNS.map((r) => (
        <div key={r.pattern} style={rowStyle}>
          <span style={{ color: '#b9a6ff' }}>GET</span>
          <span>
            <span style={{ color: 'var(--c-accent-mint, #7ef4cb)' }}>{r.pattern}</span>
            <span style={{ color: 'var(--c-dim, #8a92a1)' }}>{'  // ' + r.label}</span>
          </span>
        </div>
      ))}
    </>
  );
}

interface HistoryEntry {
  id: number;
  command: string;
  output: ReactNode;
}

export default function NotFound() {
  const pathname = usePathname();
  const router = useRouter();

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [logIndex, setLogIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [history]);

  const focusInput = () => inputRef.current?.focus();

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    const id = idRef.current++;

    if (!trimmed) {
      setHistory((h) => [...h, { id, command: '', output: null }]);
      return;
    }

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ');
    let output: ReactNode = null;

    switch (cmd) {
      case 'help':
        output = (
          <div style={{ color: 'var(--c-dim, #8a92a1)' }}>
            {'available commands: ' + COMMANDS.join(', ')}
          </div>
        );
        break;

      case 'ls':
      case 'routes':
        output = <RouteDump />;
        break;

      case 'pwd':
        output = <div>{pathname || '/'}</div>;
        break;

      case 'whoami':
        output = <div>guest@relay (404 — not authenticated to a route)</div>;
        break;

      case 'clear':
        setHistory([]);
        setInput('');
        return;

      case 'curl': {
        const target = arg.replace(/^-\w+\s+/, '').trim() || '/';
        const normalized = target.startsWith('/') ? target : `/${target}`;
        const known = PAGES.some((p) => p.path === normalized);
        output = known ? (
          <span style={{ color: 'var(--c-accent-mint, #7ef4cb)', fontWeight: 700 }}>HTTP/1.1 200 OK</span>
        ) : (
          <span style={{ color: 'var(--c-accent-error, #ff9e9e)', fontWeight: 700 }}>HTTP/1.1 404 Not Found</span>
        );
        break;
      }

      case 'cd': {
        const target = arg.trim();
        if (!target || target === '~' || target === '/') {
          router.push('/');
          output = <div style={{ color: 'var(--c-dim, #8a92a1)' }}>navigating to /…</div>;
        } else {
          const normalized = target.startsWith('/') ? target : `/${target}`;
          const match = PAGES.find((p) => p.path === normalized);
          if (match) {
            router.push(match.path);
            output = <div style={{ color: 'var(--c-dim, #8a92a1)' }}>{`navigating to ${match.path}…`}</div>;
          } else {
            output = <div style={{ color: 'var(--c-accent-error, #ff9e9e)' }}>{`cd: no such route: ${normalized}`}</div>;
          }
        }
        break;
      }

      default:
        output = (
          <div style={{ color: 'var(--c-accent-error, #ff9e9e)' }}>
            {`command not found: ${cmd} — try `}
            <span style={{ color: 'var(--c-text, #eef1f6)' }}>help</span>
          </div>
        );
    }

    setHistory((h) => [...h, { id, command: trimmed, output }]);
    setCommandLog((log) => [...log, trimmed]);
    setLogIndex(null);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandLog.length === 0) return;
      const nextIndex = logIndex === null ? commandLog.length - 1 : Math.max(0, logIndex - 1);
      setLogIndex(nextIndex);
      setInput(commandLog[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (logIndex === null) return;
      const nextIndex = logIndex + 1;
      if (nextIndex >= commandLog.length) {
        setLogIndex(null);
        setInput('');
      } else {
        setLogIndex(nextIndex);
        setInput(commandLog[nextIndex]);
      }
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        background:
          'radial-gradient(ellipse at 30% 20%, var(--wash-violet, #1a1035) 0%, var(--wash-base, #0a0a0a) 55%), radial-gradient(ellipse at 75% 80%, var(--wash-teal, #0d1f2d) 0%, var(--wash-base, #0a0a0a) 60%)',
      }}
    >
      <style>{`
        @keyframes nf-cursor-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .nf-cursor { animation: nf-cursor-blink 1s step-end infinite; }
        .nf-route-link { color: var(--c-accent-mint, #7ef4cb); text-decoration: none; }
        .nf-route-link:hover { text-decoration: underline; }
        .nf-back-link { color: var(--c-dim, #8a92a1); }
        .nf-back-link:hover { color: var(--c-text, #eef1f6); }
        .nf-terminal-input { caret-color: var(--c-accent-mint, #7ef4cb); }
      `}</style>

      <Link
        href="/"
        className="nf-back-link"
        style={{
          position: 'fixed',
          top: '1.25rem',
          left: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.5rem 0.9rem',
          borderRadius: '0.75rem',
          fontFamily: 'var(--font-body, system-ui, sans-serif)',
          fontSize: '0.8rem',
          textDecoration: 'none',
          transition: 'color 0.2s ease',
        }}
      >
        ← Back to app
      </Link>

      <div
        style={{
          width: 'min(680px, 94vw)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#0b0b0d',
          boxShadow: '0 28px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
          overflow: 'hidden',
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        }}
      >
        {/* Terminal chrome */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.6rem 0.85rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.32rem' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff6259' }} />
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e' }} />
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#28c93f' }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--c-dim, #8a92a1)' }}>relay — router — 80×24</span>
        </div>

        {/* Terminal body */}
        <div
          onClick={focusInput}
          style={{
            padding: '1.1rem 1.2rem 1.4rem',
            fontSize: '0.8rem',
            color: '#c9d1d9',
            overflowX: 'auto',
            maxHeight: '70vh',
            overflowY: 'auto',
            cursor: 'text',
          }}
        >
          <div style={{ color: 'var(--c-dim, #8a92a1)' }}>
            <span style={{ color: 'var(--c-accent-mint, #7ef4cb)' }}>relay@edge</span>:~$ curl -I https://relay{pathname || '/unknown'}
          </div>
          <div style={{ margin: '0.25rem 0 1rem' }}>
            <span style={{ color: 'var(--c-accent-error, #ff9e9e)', fontWeight: 700 }}>HTTP/1.1 404 Not Found</span>
            <br />
            <span style={{ color: 'var(--c-dim, #8a92a1)' }}>x-served-by: relay-router</span>
          </div>

          <div style={{ color: 'var(--c-dim, #8a92a1)' }}>
            <span style={{ color: 'var(--c-accent-mint, #7ef4cb)' }}>relay@edge</span>:~$ relay-router --dump routes
          </div>

          <RouteDump />

          <div style={{ margin: '0.9rem 0 0.4rem', color: 'var(--c-dim, #8a92a1)', fontStyle: 'italic' }}>
            {'// try it yourself — help, ls, cd <path>, curl <path>, whoami, clear'}
          </div>

          {history.map((entry) => (
            <div key={entry.id}>
              <div style={{ color: 'var(--c-dim, #8a92a1)' }}>
                <span style={{ color: 'var(--c-accent-mint, #7ef4cb)' }}>relay@edge</span>:~$ {entry.command}
              </div>
              {entry.output && <div style={{ margin: '0.15rem 0 0.5rem' }}>{entry.output}</div>}
            </div>
          ))}

          <div style={{ marginTop: history.length ? 0 : '1rem', color: 'var(--c-dim, #8a92a1)', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'var(--c-accent-mint, #7ef4cb)', flexShrink: 0 }}>relay@edge</span>:~$&nbsp;
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              className="nf-terminal-input"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--c-text, #eef1f6)',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            />
            <span className="nf-cursor" aria-hidden="true">▊</span>
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </main>
  );
}
