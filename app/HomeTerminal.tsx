'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FREE_MAX_FILE_BYTES,
  FREE_STORAGE_LIMIT_BYTES,
  PLUS_MAX_FILE_BYTES,
  PLUS_STORAGE_LIMIT_BYTES,
} from '@/app/lib/plan-limits';

// Single source of truth (app/lib/plan-limits.ts) drives these labels
// directly, rather than mirroring the numbers as separate literals here —
// that mirroring is exactly what let this page's copy drift out of sync
// with the real limits the last time they changed.
function formatLimit(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${Math.round(gb)}gb` : `${Math.round(bytes / (1024 * 1024))}mb`;
}

const MANIFEST = [
  { k: 'free_tier_upload_limit', v: `${formatLimit(FREE_MAX_FILE_BYTES)} / file` },
  { k: 'free_tier_total_storage', v: `${formatLimit(FREE_STORAGE_LIMIT_BYTES)} total` },
  { k: 'plus_tier_upload_limit', v: `${formatLimit(PLUS_MAX_FILE_BYTES)} / file` },
  { k: 'plus_vault', v: `${formatLimit(PLUS_STORAGE_LIMIT_BYTES)} total` },
  { k: 'retention', v: '15d idle → gone' },
  { k: 'signup_required', v: 'false' },
];

// Same key the classic homepage uses for its local "recent uploads" list
// (see app/HomeClassic.tsx) — sharing it means a file pushed from either
// style shows up in both, since neither style has a server-side account to
// keep this in instead.
const RECENT_KEY = 'relay:uploadedFiles';
const RECENT_LIMIT = 50;
const RECENT_DISPLAY = 5;

type LogTone = 'dim' | 'link' | 'err';
type LogLine = { text: string; tone?: LogTone; href?: string };
type Panel = 'none' | 'snippet' | 'remote';
type RecentItem = { url: string; filename: string; size: number; timestamp: number };

function randomName(originalFilename: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  const ext = originalFilename.includes('.') ? '.' + originalFilename.split('.').pop() : '';
  return out + ext;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}gb`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  return `${bytes}b`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function loadRecent(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentItem[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, RECENT_LIMIT)));
  } catch {
    // Best effort — a full/blocked localStorage shouldn't break uploading.
  }
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

type RemotePullDone = { url: string; filename?: string; size?: number };

// Reads the /api/remote-upload/stream response, which emits one JSON object
// per newline (progress/done/error) rather than a single JSON body.
async function readRemotePullStream(res: Response): Promise<RemotePullDone> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let evt: { type?: string; error?: string; data?: RemotePullDone };
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      if (evt.type === 'error') throw new Error(evt.error || 'remote pull failed');
      if (evt.type === 'done' && evt.data?.url) return evt.data;
    }
  }

  throw new Error('remote pull failed');
}

const IDLE_LINES: LogLine[] = [
  { text: 'nothing run yet.', tone: 'dim' },
];

export default function HomeTerminal() {
  const [lines, setLines] = useState<LogLine[]>(IDLE_LINES);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>('none');
  const [snippetText, setSnippetText] = useState('');
  const [remoteUrlText, setRemoteUrlText] = useState('');
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const log = (text: string, tone?: LogTone, href?: string) =>
    setLines((prev) => [...prev.slice(-7), { text, tone, href }]);

  const pushRecent = (item: RecentItem) => {
    setRecent((prev) => {
      const next = [item, ...prev].slice(0, RECENT_LIMIT);
      saveRecent(next);
      return next;
    });
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500);
    } catch {
      // Clipboard permission denied — the link is still right there to select by hand.
    }
  };

  const runUpload = async (file: File) => {
    if (busy) return;
    if (file.size > FREE_MAX_FILE_BYTES) {
      setLines([{ text: `push ./${file.name}` }, { text: `over the ${formatLimit(FREE_MAX_FILE_BYTES)} free-tier limit (${formatBytes(file.size)})`, tone: 'err' }]);
      return;
    }
    setBusy(true);
    setPanel('none');
    setLines([{ text: `push ./${file.name}` }]);
    try {
      log('hashing', 'dim');
      const hash = await hashFile(file);

      const pathname = randomName(file.name);
      const initRes = await fetch('/api/multipart/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          filename: file.name,
        }),
      });
      const initPayload = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initPayload?.data?.uploadId) {
        throw new Error(initPayload?.error || 'failed to start upload');
      }
      const { uploadId, objectKey, partSize } = initPayload.data;

      const effectivePartSize = Math.max(5 * 1024 * 1024, Number(partSize) || 8 * 1024 * 1024);
      const totalParts = Math.max(1, Math.ceil(file.size / effectivePartSize));
      const parts: { partNumber: number; etag: string }[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        log(`uploading — part ${partNumber}/${totalParts}`, 'dim');
        const start = (partNumber - 1) * effectivePartSize;
        const end = Math.min(file.size, start + effectivePartSize);

        const partRes = await fetch('/api/multipart/part', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, objectKey, partNumber }),
        });
        const partPayload = await partRes.json().catch(() => ({}));
        if (!partRes.ok || !partPayload?.data?.url) {
          throw new Error(partPayload?.error || 'failed to presign part');
        }

        const putRes = await fetch(partPayload.data.url, { method: 'PUT', body: file.slice(start, end) });
        if (!putRes.ok) throw new Error('part upload failed');
        const etag = (putRes.headers.get('ETag') || '').replace(/^"|"$/g, '');
        parts.push({ partNumber, etag });
      }

      const completeRes = await fetch('/api/multipart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, objectKey, parts }),
      });
      const completePayload = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) throw new Error(completePayload?.error || 'failed to finish upload');

      // Malware check runs before the link is ever shown — a flagged hash
      // gets quarantined server-side and this throws instead of printing a link.
      const commitRes = await fetch('/api/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit: true,
          hash,
          objectKey,
          size: file.size,
          filename: file.name,
          contentType: file.type || undefined,
        }),
      });
      const commitPayload = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok) throw new Error(commitPayload?.error || 'file could not be verified');

      const uniqueName = String(objectKey).split('/').pop();
      const url = `${window.location.origin}/d/${uniqueName}`;
      const timestamp = Date.now();

      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename: file.name, size: file.size }),
      }).catch(() => {});

      pushRecent({ url, filename: file.name, size: file.size, timestamp });
      log(`done — ${formatBytes(file.size)}`);
      log(url.replace(/^https?:\/\//, ''), 'link', url);
    } catch (error) {
      log(error instanceof Error ? error.message : 'upload failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const runSnippet = async () => {
    if (busy || !snippetText.trim()) return;
    setBusy(true);
    setPanel('none');
    setLines([{ text: 'snip' }]);
    try {
      log('pushing snippet', 'dim');
      const res = await fetch('/api/snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: snippetText }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.record?.url) throw new Error(payload?.error || 'snippet failed');
      const { url, filename, size } = payload.record;
      pushRecent({ url, filename: filename || 'snippet.txt', size: size || 0, timestamp: Date.now() });
      log(`done — ${formatBytes(size || 0)}`);
      log(String(url).replace(/^https?:\/\//, ''), 'link', url);
      setSnippetText('');
    } catch (error) {
      log(error instanceof Error ? error.message : 'snippet failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const runRemotePull = async () => {
    if (busy || !remoteUrlText.trim()) return;
    const trimmed = remoteUrlText.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch {
      log('enter a valid http(s) url', 'err');
      return;
    }

    setBusy(true);
    setPanel('none');
    setLines([{ text: `pull ${trimmed}` }]);
    try {
      log('downloading', 'dim');
      const res = await fetch('/api/remote-upload/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'remote pull failed');
      }

      const { url, filename, size } = await readRemotePullStream(res);

      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename: filename || 'remote-file', size: size || 0 }),
      }).catch(() => {});

      pushRecent({ url, filename: filename || 'remote-file', size: size || 0, timestamp: Date.now() });
      log(`done — ${formatBytes(size || 0)}`);
      log(String(url).replace(/^https?:\/\//, ''), 'link', url);
      setRemoteUrlText('');
    } catch (error) {
      log(error instanceof Error ? error.message : 'remote pull failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="tpage">
      <style>{`
        .tpage {
          --bg: #060606;
          --fg: #ededed;
          --fg-dim: #8a8a8a;
          --fg-faint: #4a4a4a;
          --fg-ghost: #232323;
          min-height: 100vh;
          background: var(--bg);
          color: var(--fg);
          font-family: var(--font-mono), ui-monospace, monospace;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: clamp(2rem, 6vw, 5rem) 1.5rem 3rem;
        }
        .tpage a { color: var(--fg); }
        .tpage ::selection { background: var(--fg); color: var(--bg); }
        .tpage :focus-visible { outline: 1px dashed var(--fg); outline-offset: 2px; }
        .t-wrap { width: 100%; max-width: 680px; }

        .t-nav {
          display: flex;
          align-items: center;
          margin-bottom: clamp(3rem, 10vw, 6rem);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .t-nav .mark { display: flex; align-items: center; gap: 0.5rem; }
        .t-diamond {
          width: 9px; height: 9px;
          border: 1px solid var(--fg);
          transform: rotate(45deg);
          flex-shrink: 0;
        }

        .t-h1 {
          font-size: clamp(1.5rem, 4.5vw, 2.1rem);
          line-height: 1.35;
          font-weight: 400;
          margin: 0 0 0.9rem;
          letter-spacing: -0.01em;
        }
        .t-h1 .dim { color: var(--fg-dim); }
        .t-sub {
          font-size: 0.82rem;
          color: var(--fg-dim);
          line-height: 1.6;
          margin: 0 0 2.4rem;
          max-width: 52ch;
        }

        /* OUTPUT — plain command output, no fake terminal-window chrome.
           Status is signalled the way real monochrome terminals always
           have: reverse video, not color. */
        .t-output {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.82rem;
          line-height: 1.8;
          margin-bottom: 1.3rem;
          min-height: 3rem;
        }
        .out-line { white-space: pre-wrap; word-break: break-word; }
        .out-line--dim { color: var(--fg-faint); }
        .out-line--link a { text-decoration: underline; text-underline-offset: 2px; color: var(--fg); }
        .out-line--err {
          display: inline-block;
          background: var(--fg);
          color: var(--bg);
          font-weight: 700;
          padding: 0.05rem 0.4ch;
        }
        .out-line--err::before { content: '✗ '; }
        .t-cursor {
          display: inline-block;
          width: 7px; height: 1.05em;
          background: var(--fg);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: t-caret 0.8s step-end infinite;
        }
        @keyframes t-caret { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .t-cursor { animation: none; } }

        .t-actions {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin-bottom: 0.6rem;
        }
        .t-action-btn {
          font-family: inherit;
          font-size: 0.74rem;
          background: transparent;
          color: var(--fg);
          border: 1px solid var(--fg-faint);
          padding: 0.55rem 0.9rem;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .t-action-btn:hover:not(:disabled) { border-color: var(--fg); background: var(--fg-ghost); }
        .t-action-btn[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
        .t-action-btn:disabled { opacity: 0.4; cursor: default; }

        .t-inline-panel {
          border: 1px solid var(--fg-ghost);
          padding: 0.9rem;
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .t-inline-panel textarea,
        .t-inline-panel input {
          font-family: inherit;
          font-size: 0.78rem;
          background: var(--bg);
          color: var(--fg);
          border: 1px solid var(--fg-faint);
          padding: 0.6rem 0.7rem;
          resize: vertical;
        }
        .t-inline-panel textarea:focus,
        .t-inline-panel input:focus { outline: none; border-color: var(--fg); }
        .t-inline-panel-row { display: flex; gap: 0.5rem; justify-content: flex-end; }

        .t-disclaimer {
          font-size: 0.68rem;
          color: var(--fg-faint);
          line-height: 1.6;
          margin-bottom: 2rem;
          max-width: 56ch;
        }

        .t-recent { margin-bottom: 2.4rem; font-size: 0.76rem; }
        .t-recent-head {
          color: var(--fg-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.66rem;
          margin-bottom: 0.6rem;
        }
        .t-recent-empty { color: var(--fg-faint); }
        .t-recent-row {
          display: flex;
          align-items: baseline;
          gap: 0.7rem;
          padding: 0.45rem 0;
          border-bottom: 1px solid var(--fg-ghost);
        }
        .t-recent-row:last-child { border-bottom: none; }
        .t-recent-name {
          flex: 1;
          min-width: 0;
          color: var(--fg);
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .t-recent-name:hover { text-decoration: underline; }
        .t-recent-meta { color: var(--fg-faint); font-size: 0.68rem; white-space: nowrap; }
        .t-recent-copy {
          font-family: inherit;
          font-size: 0.66rem;
          background: transparent;
          color: var(--fg-dim);
          border: 1px solid var(--fg-faint);
          padding: 0.2rem 0.55rem;
          cursor: pointer;
          flex-shrink: 0;
        }
        .t-recent-copy:hover { color: var(--fg); border-color: var(--fg); }

        .t-manifest {
          border-top: 1px solid var(--fg-ghost);
          border-bottom: 1px solid var(--fg-ghost);
          padding: 1.1rem 0;
          margin-bottom: 2.4rem;
          font-size: 0.74rem;
        }
        .t-manifest-row {
          display: flex;
          justify-content: space-between;
          padding: 0.32rem 0;
          color: var(--fg-dim);
        }
        .t-manifest-row b { color: var(--fg); font-weight: 400; }

        .t-cta {
          display: flex;
          gap: 0.7rem;
          flex-wrap: wrap;
        }
        .t-btn {
          display: inline-block;
          padding: 0.7rem 1.1rem;
          font-size: 0.76rem;
          text-decoration: none;
          border: 1px solid var(--fg);
          transition: background 0.15s ease, color 0.15s ease;
        }
        .tpage a.t-btn--solid { background: var(--fg); color: var(--bg); }
        .tpage a.t-btn--solid:hover { opacity: 0.85; }
        .t-btn--outline { color: var(--fg); }
        .t-btn--outline:hover { background: var(--fg); color: var(--bg); }
      `}</style>

      <div className="t-wrap">
        <nav className="t-nav">
          <span className="mark">
            <span className="t-diamond" />
            relay
          </span>
        </nav>

        <h1 className="t-h1">
          Share a file.<br />
          Get a link.<br />
          <span className="dim">Nothing else.</span>
        </h1>
        <p className="t-sub">
          No account, no dashboard tour, no upsell before you&apos;ve uploaded a single byte.
          This terminal is wired to the real thing — try it.
        </p>

        <div className="t-output">
          {lines.map((line, i) => (
            <div
              key={`${i}-${line.text}`}
              className={`out-line ${line.tone ? `out-line--${line.tone}` : ''}`}
            >
              {line.href ? <a href={line.href}>{line.text}</a> : line.text}
              {i === lines.length - 1 && line.tone !== 'err' && <span className="t-cursor" aria-hidden="true" />}
            </div>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) runUpload(file);
          }}
        />

        <div className="t-actions">
          <button
            type="button"
            className="t-action-btn"
            aria-pressed={panel === 'snippet'}
            disabled={busy}
            onClick={() => setPanel((p) => (p === 'snippet' ? 'none' : 'snippet'))}
          >
            Snip code
          </button>
          <button
            type="button"
            className="t-action-btn"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload file
          </button>
          <button
            type="button"
            className="t-action-btn"
            aria-pressed={panel === 'remote'}
            disabled={busy}
            onClick={() => setPanel((p) => (p === 'remote' ? 'none' : 'remote'))}
          >
            Remote pull
          </button>
        </div>

        {panel === 'snippet' && (
          <div className="t-inline-panel">
            <textarea
              rows={5}
              placeholder="paste code here…"
              value={snippetText}
              onChange={(e) => setSnippetText(e.target.value)}
              autoFocus
            />
            <div className="t-inline-panel-row">
              <button type="button" className="t-action-btn" onClick={() => setPanel('none')}>Cancel</button>
              <button type="button" className="t-action-btn" disabled={!snippetText.trim() || busy} onClick={runSnippet}>Push snippet</button>
            </div>
          </div>
        )}

        {panel === 'remote' && (
          <div className="t-inline-panel">
            <input
              type="url"
              placeholder="https://example.com/file.zip"
              value={remoteUrlText}
              onChange={(e) => setRemoteUrlText(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') runRemotePull(); }}
            />
            <div className="t-inline-panel-row">
              <button type="button" className="t-action-btn" onClick={() => setPanel('none')}>Cancel</button>
              <button type="button" className="t-action-btn" disabled={!remoteUrlText.trim() || busy} onClick={runRemotePull}>Pull</button>
            </div>
          </div>
        )}

        <p className="t-disclaimer">
          &quot;Upload file&quot; opens your browser&apos;s own file picker — Relay only ever reads the
          single file you choose there. We get no access to your folders or any other files, and
          nothing more once the upload finishes.
        </p>

        <div className="t-recent">
          <div className="t-recent-head">recent</div>
          {recent.length === 0 ? (
            <div className="t-recent-empty">nothing yet — try the terminal above.</div>
          ) : (
            recent.slice(0, RECENT_DISPLAY).map((item) => (
              <div className="t-recent-row" key={`${item.url}-${item.timestamp}`}>
                <a href={item.url} className="t-recent-name">{item.filename}</a>
                <span className="t-recent-meta">{formatBytes(item.size)} · {formatRelativeTime(item.timestamp)}</span>
                <button type="button" className="t-recent-copy" onClick={() => copyLink(item.url)}>
                  {copiedUrl === item.url ? 'copied' : 'copy'}
                </button>
              </div>
            ))
          )}
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
          <Link href="/pricing" className="t-btn t-btn--solid">See pricing</Link>
          <Link href="/docs" className="t-btn t-btn--outline">API docs</Link>
        </div>
      </div>
    </main>
  );
}
