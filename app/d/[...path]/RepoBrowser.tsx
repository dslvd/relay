'use client';

import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import CodeBlock from '../../components/CodeBlock';
import { languageFromFilename } from '../../lib/lang-map';

const MAX_PREVIEW_BYTES = 300 * 1024;
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'pdf', 'zip', 'gz', 'tar',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp4', 'webm', 'mp3', 'wav', 'ogg',
  'exe', 'dll', 'so', 'dylib', 'class', 'jar', 'wasm', 'node',
]);

interface TreeEntry {
  path: string;
  name: string;
  depth: number;
  isDir: boolean;
  size: number;
}

interface RepoBrowserProps {
  previewUrl: string;
  onReady?: () => void;
}

export default function RepoBrowser({ previewUrl, onReady }: RepoBrowserProps) {
  const [zip, setZip] = useState<JSZip | null>(null);
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [selectedIsBinary, setSelectedIsBinary] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingZip, setLoadingZip] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingZip(true);
        const res = await fetch(previewUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to download archive');
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const loaded = await JSZip.loadAsync(buffer);
        if (cancelled) return;

        const list: TreeEntry[] = Object.values(loaded.files)
          .filter((f) => !f.name.split('/').pop()?.startsWith('.'))
          .map((f) => {
            const trimmed = f.name.replace(/\/$/, '');
            const parts = trimmed.split('/');
            return {
              path: f.name,
              name: parts[parts.length - 1],
              depth: parts.length - 1,
              isDir: f.dir,
              // @ts-expect-error - _data is present at runtime but not in JSZip's public types
              size: f._data?.uncompressedSize ?? 0,
            };
          })
          .sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.path.localeCompare(b.path);
          });

        setZip(loaded);
        setEntries(list);

        const firstFile = list.find((e) => !e.isDir);
        if (firstFile) setSelectedPath(firstFile.path);
      } catch {
        if (!cancelled) setError('Could not read this archive.');
      } finally {
        if (!cancelled) {
          setLoadingZip(false);
          onReady?.();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  useEffect(() => {
    if (!zip || !selectedPath) return;
    let cancelled = false;

    (async () => {
      const entry = entries.find((e) => e.path === selectedPath);
      const ext = selectedPath.split('.').pop()?.toLowerCase() || '';

      if ((entry && entry.size > MAX_PREVIEW_BYTES) || BINARY_EXTENSIONS.has(ext)) {
        setSelectedIsBinary(true);
        setSelectedContent(null);
        return;
      }

      setLoadingFile(true);
      setSelectedIsBinary(false);
      try {
        const file = zip.file(selectedPath);
        if (!file) return;
        const text = await file.async('string');
        if (!cancelled) setSelectedContent(text);
      } finally {
        if (!cancelled) setLoadingFile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [zip, selectedPath, entries]);

  const language = useMemo(
    () => (selectedPath ? languageFromFilename(selectedPath) : 'plaintext'),
    [selectedPath]
  );

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'var(--c-dim)', fontSize: '0.82rem' }}>
        {error}
      </div>
    );
  }

  if (loadingZip) {
    return (
      <div style={{ padding: '1rem', color: 'var(--c-dim)', fontSize: '0.82rem' }}>
        Unpacking archive…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '460px',
        borderRadius: '12px',
        border: '1px solid rgba(128,128,128,0.14)',
        background: 'rgba(128,128,128,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '220px',
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: '1px solid rgba(128,128,128,0.14)',
          padding: '0.5rem 0',
        }}
      >
        {entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => !entry.isDir && setSelectedPath(entry.path)}
            disabled={entry.isDir}
            title={entry.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              textAlign: 'left',
              padding: '0.3rem 0.6rem',
              paddingLeft: `${0.6 + entry.depth * 0.9}rem`,
              background: selectedPath === entry.path ? 'rgba(126,244,203,0.1)' : 'transparent',
              border: 'none',
              cursor: entry.isDir ? 'default' : 'pointer',
              color: entry.isDir ? 'var(--c-dim)' : selectedPath === entry.path ? 'var(--c-accent-mint)' : 'var(--c-text)',
              fontSize: '0.74rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: entry.isDir ? 700 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.isDir ? '📁 ' : ''}{entry.name}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0.8rem' }}>
        {!selectedPath ? (
          <span style={{ fontSize: '0.78rem', color: 'var(--c-dim)' }}>
            Select a file to preview it.
          </span>
        ) : loadingFile ? (
          <span style={{ fontSize: '0.78rem', color: 'var(--c-dim)' }}>Loading…</span>
        ) : selectedIsBinary ? (
          <span style={{ fontSize: '0.78rem', color: 'var(--c-dim)' }}>
            Binary or large file - not shown.
          </span>
        ) : selectedContent !== null ? (
          <CodeBlock code={selectedContent} language={language} />
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'var(--c-dim)' }}>No preview</span>
        )}
      </div>
    </div>
  );
}
