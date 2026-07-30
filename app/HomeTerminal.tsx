'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const MANIFEST = [
  { k: 'free_tier_limit', v: '100mb / file' },
  { k: 'plus_tier_limit', v: '8gb / file' },
  { k: 'plus_vault', v: '80gb total' },
  { k: 'retention', v: '15d idle → gone' },
  { k: 'signup_required', v: 'false' },
];

// Mirrors app/lib/plan-limits.ts's FREE_MAX_FILE_BYTES — kept as a literal
// here so this client bundle doesn't need to import server-side config.
const FREE_MAX_FILE_BYTES = 100 * 1024 * 1024;

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
      setLines([{ text: `push ./${file.name}` }, { text: `over the 100mb free-tier limit (${formatBytes(file.size)})`, tone: 'err' }]);
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
          padding: clamp(2.5rem, 6vw, 5rem) 1.25rem 4rem;
        }
        .tpage a { color: var(--fg); }
        .tpage ::selection { background: var(--fg); color: var(--bg); }
        .tpage :focus-visible { outline: 1px dashed var(--fg); outline-offset: 2px; }

        .t-wrap { width: 100%; max-width: 70ch; font-size: 0.86rem; }

        /* man(1)-style header/footer bar — the one authentic borrowing this
           whole page is built around: NAME(SECTION) on both edges, the
           manual's title centered, exactly like "man" renders on any unix box. */
        .man-bar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          font-size: 0.7rem;
          letter-spacing: 0.03em;
          color: var(--fg-dim);
          padding-bottom: 0.9rem;
          border-bottom: 1px solid var(--fg-ghost);
        }
        .man-bar span:nth-child(2) { flex: 1; text-align: center; }
        .man-bar--foot {
          border-bottom: none;
          border-top: 1px solid var(--fg-ghost);
          padding-top: 0.9rem;
          padding-bottom: 0;
          margin-top: 2.6rem;
        }

        .man-section { margin-top: 1.9rem; }
        .man-h {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: var(--fg);
          margin: 0 0 0.6rem;
        }
        .man-body {
          padding-left: 2ch;
          color: var(--fg-dim);
          line-height: 1.7;
          max-width: 62ch;
        }
        .man-body b { color: var(--fg); font-weight: 700; }
        .man-dim { color: var(--fg-faint); margin: 0; }

        /* SYNOPSIS — the three commands double as the actual controls. */
        .man-syn { display: flex; flex-direction: column; gap: 0.15rem; max-width: none; }
        .syn-line {
          appearance: none;
          display: block;
          width: fit-content;
          max-width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          color: var(--fg);
          font-family: inherit;
          font-size: 0.95rem;
          padding: 0.2rem 0;
          margin: 0.1rem 0;
          cursor: pointer;
        }
        .syn-line::before { content: '$ '; color: var(--fg-faint); }
        .syn-line:hover:not(:disabled),
        .syn-line[aria-expanded="true"] { text-decoration: underline; text-underline-offset: 3px; }
        .syn-line:disabled { color: var(--fg-faint); cursor: default; }
        .syn-note {
          color: var(--fg-faint);
          font-size: 0.72rem;
          margin: 0 0 0.7rem;
          padding-left: 2ch;
        }
        .syn-block {
          margin: 0.4rem 0 1rem 2ch;
          padding: 0.8rem;
          border: 1px solid var(--fg-ghost);
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .syn-block textarea,
        .syn-block input {
          font-family: inherit;
          font-size: 0.82rem;
          background: var(--bg);
          color: var(--fg);
          border: 1px solid var(--fg-faint);
          padding: 0.55rem 0.65rem;
          resize: vertical;
        }
        .syn-block textarea:focus,
        .syn-block input:focus { outline: none; border-color: var(--fg); }
        .syn-block-row { display: flex; gap: 0.5rem; justify-content: flex-end; }

        .man-btn {
          font-family: inherit;
          font-size: 0.7rem;
          background: transparent;
          color: var(--fg-dim);
          border: 1px solid var(--fg-faint);
          padding: 0.35rem 0.7rem;
          cursor: pointer;
        }
        .man-btn:hover:not(:disabled) { color: var(--fg); border-color: var(--fg); }
        .man-btn:disabled { opacity: 0.4; cursor: default; }
        .man-btn--solid { background: var(--fg); color: var(--bg); border-color: var(--fg); }
        .man-btn--solid:hover:not(:disabled) { background: var(--fg); color: var(--bg); opacity: 0.85; }

        /* OUTPUT — plain command output, no fake window chrome. Status is
           signalled the way real monochrome terminals always have: reverse
           video, not color. */
        .man-output { display: flex; flex-direction: column; gap: 0.2rem; max-width: none; }
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
        .man-cursor {
          display: inline-block;
          width: 0.6ch; height: 1em;
          background: var(--fg);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: man-caret 0.8s step-end infinite;
        }
        @keyframes man-caret { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .man-cursor { animation: none; } }

        /* RECENT */
        .recent-row {
          display: flex;
          align-items: baseline;
          gap: 0.7rem;
          padding: 0.4rem 0;
          border-bottom: 1px solid var(--fg-ghost);
        }
        .recent-row:last-child { border-bottom: none; }
        .recent-name {
          flex: 1;
          min-width: 0;
          color: var(--fg);
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .recent-name:hover { text-decoration: underline; }
        .recent-meta { color: var(--fg-faint); font-size: 0.72rem; white-space: nowrap; }

        /* LIMITS — dot-leader table, same trick used in a printed manual's
           table of contents to tie a label to its value across the gap. */
        .limits-row { display: flex; align-items: baseline; gap: 0.6ch; max-width: none; }
        .limits-row .leader { flex: 1; overflow: hidden; white-space: nowrap; }
        .limits-row .leader::after {
          content: '. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ';
          color: var(--fg-ghost);
        }
        .limits-row b { flex-shrink: 0; }

        @media (max-width: 560px) {
          .limits-row .leader { display: none; }
          .limits-row { justify-content: space-between; }
        }
      `}</style>

      <div className="t-wrap">
        <header className="man-bar">
          <span>RELAY(1)</span>
          <span>Developer Commands</span>
          <span>RELAY(1)</span>
        </header>

        <section className="man-section">
          <h2 className="man-h">NAME</h2>
          <p className="man-body">
            <b>relay</b> — push a file, snip code, or pull a url. no account, no dashboard.
          </p>
        </section>

        <section className="man-section">
          <h2 className="man-h">SYNOPSIS</h2>
          <div className="man-body man-syn">
            <button
              type="button"
              className="syn-line"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              relay push &lt;file&gt;
            </button>
            <p className="syn-note"># opens your device&apos;s file picker — relay only reads the one file you choose, nothing else, before or after.</p>

            <button
              type="button"
              className="syn-line"
              aria-expanded={panel === 'snippet'}
              disabled={busy}
              onClick={() => setPanel((p) => (p === 'snippet' ? 'none' : 'snippet'))}
            >
              relay snip
            </button>
            {panel === 'snippet' && (
              <div className="syn-block">
                <textarea
                  rows={5}
                  placeholder="paste code here…"
                  value={snippetText}
                  onChange={(e) => setSnippetText(e.target.value)}
                  autoFocus
                />
                <div className="syn-block-row">
                  <button type="button" className="man-btn" onClick={() => setPanel('none')}>cancel</button>
                  <button type="button" className="man-btn man-btn--solid" disabled={!snippetText.trim() || busy} onClick={runSnippet}>push →</button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="syn-line"
              aria-expanded={panel === 'remote'}
              disabled={busy}
              onClick={() => setPanel((p) => (p === 'remote' ? 'none' : 'remote'))}
            >
              relay pull &lt;url&gt;
            </button>
            {panel === 'remote' && (
              <div className="syn-block">
                <input
                  type="url"
                  placeholder="https://example.com/file.zip"
                  value={remoteUrlText}
                  onChange={(e) => setRemoteUrlText(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') runRemotePull(); }}
                />
                <div className="syn-block-row">
                  <button type="button" className="man-btn" onClick={() => setPanel('none')}>cancel</button>
                  <button type="button" className="man-btn man-btn--solid" disabled={!remoteUrlText.trim() || busy} onClick={runRemotePull}>pull →</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="man-section">
          <h2 className="man-h">DESCRIPTION</h2>
          <p className="man-body">
            Upload something, get a link back. Files and snippets sit for 15 days without a
            visit, then they&apos;re gone — like /tmp, but shareable.
          </p>
        </section>

        <section className="man-section">
          <h2 className="man-h">OUTPUT</h2>
          <div className="man-body man-output">
            {lines.map((line, i) => (
              <div
                key={`${i}-${line.text}`}
                className={`out-line ${line.tone ? `out-line--${line.tone}` : ''}`}
              >
                {line.href ? <a href={line.href}>{line.text}</a> : line.text}
                {i === lines.length - 1 && line.tone !== 'err' && <span className="man-cursor" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </section>

        <section className="man-section">
          <h2 className="man-h">RECENT{recent.length ? `(${Math.min(recent.length, RECENT_DISPLAY)})` : ''}</h2>
          <div className="man-body">
            {recent.length === 0 ? (
              <p className="man-dim">nothing yet — try a command above.</p>
            ) : (
              recent.slice(0, RECENT_DISPLAY).map((item) => (
                <div className="recent-row" key={`${item.url}-${item.timestamp}`}>
                  <a href={item.url} className="recent-name">{item.filename}</a>
                  <span className="recent-meta">{formatBytes(item.size)} · {formatRelativeTime(item.timestamp)}</span>
                  <button type="button" className="man-btn" onClick={() => copyLink(item.url)}>
                    {copiedUrl === item.url ? 'copied' : 'copy'}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="man-section">
          <h2 className="man-h">LIMITS</h2>
          <div className="man-body">
            {MANIFEST.map((row) => (
              <div className="limits-row" key={row.k}>
                <span>{row.k}</span>
                <span className="leader" />
                <b>{row.v}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="man-section">
          <h2 className="man-h">SEE ALSO</h2>
          <p className="man-body">
            <Link href="/pricing">pricing(1)</Link>, <Link href="/docs">docs(1)</Link>
          </p>
        </section>

        <footer className="man-bar man-bar--foot">
          <span>RELAY(1)</span>
          <span>no accounts, no ads</span>
          <span>RELAY(1)</span>
        </footer>
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
    </main>
  );
}
