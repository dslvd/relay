'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type SectionId =
  | 'welcome'
  | 'overview'
  | 'upload'
  | 'remote-upload'
  | 'retrieve'
  | 'file-info'
  | 'list'
  | 'delete';

type Lang = 'curl' | 'javascript' | 'python';

const SECTION_ORDER: SectionId[] = [
  'welcome',
  'overview',
  'upload',
  'remote-upload',
  'retrieve',
  'file-info',
  'list',
  'delete',
];

const SECTION_LABELS: Record<SectionId, string> = {
  welcome: 'Welcome',
  overview: 'Overview',
  upload: 'Upload a file',
  'remote-upload': 'Remote upload',
  retrieve: 'Retrieve a file',
  'file-info': 'Get file info',
  list: 'List files & folders',
  delete: 'Delete a file',
};

const API_SUB_SECTIONS: SectionId[] = [
  'upload',
  'remote-upload',
  'retrieve',
  'file-info',
  'list',
  'delete',
];

function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--foreground)] p-4 rounded-lg font-mono text-sm">
      <span className="text-[var(--c-accent-mint)] font-semibold mr-2">{method}</span>
      {path}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-[var(--surface-well)] border border-[var(--border-subtle)] rounded-lg p-4 overflow-x-auto text-xs sm:text-sm">
      <code className="font-mono whitespace-pre">{code}</code>
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono bg-[var(--surface-card-strong)] px-1.5 py-0.5 rounded text-xs">
      {children}
    </code>
  );
}

function CodeTabs({ samples }: { samples: Record<Lang, string> }) {
  const [lang, setLang] = useState<Lang>('curl');
  const langs: { id: Lang; label: string }[] = [
    { id: 'curl', label: 'cURL' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'python', label: 'Python' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {langs.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-t-md transition-colors cursor-pointer ${
              lang === l.id
                ? 'bg-[var(--surface-card)] text-[var(--foreground)] font-medium border border-b-0 border-[var(--border-subtle)]'
                : 'text-[var(--c-dim)] hover:text-[var(--foreground)]'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <CodeBlock code={samples[lang]} />
    </div>
  );
}

interface ParamRow {
  name: string;
  type: string;
  required: string;
  description: string;
}

function ParamTable({ rows, requiredHeader = 'Required' }: { rows: ParamRow[]; requiredHeader?: string }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm min-w-[500px]">
        <thead className="border-b border-[var(--border-default)]">
          <tr>
            <th className="text-left py-2 pr-4 text-[var(--foreground)]">Parameter</th>
            <th className="text-left py-2 pr-4 text-[var(--foreground)]">Type</th>
            <th className="text-left py-2 pr-4 text-[var(--foreground)]">{requiredHeader}</th>
            <th className="text-left py-2 text-[var(--foreground)]">Description</th>
          </tr>
        </thead>
        <tbody className="text-[var(--c-dim)]">
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-[var(--border-subtle)]">
              <td className="py-2 pr-4 font-mono">{row.name}</td>
              <td className="py-2 pr-4">{row.type}</td>
              <td className="py-2 pr-4">{row.required}</td>
              <td className="py-2">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mt-8">
      <h3 className="text-xl font-semibold text-[var(--foreground)]">{title}</h3>
      {children}
    </div>
  );
}

const FAQ_ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How does Relay work?',
    a: 'Relay is a file hosting service that lets you upload files and share them with a link. Upload a file, get a unique URL, and share it with anyone. Files are stored on Cloudflare R2 and can be accessed anytime until they expire or are deleted.',
  },
  {
    q: 'Is there a limit to the file size I can upload?',
    a: 'Through the web app, free uploads are capped at 100MB and Plus accounts get up to 500MB. Through the API, anonymous uploads are capped at 25GB and expire after 15 days; uploads made with an API key have no expiration.',
  },
  {
    q: 'How do I upload a file?',
    a: 'Drag and drop a file on the homepage, or use the API described in this section for programmatic uploads.',
  },
  {
    q: 'Are there any download limitations?',
    a: 'Anyone with a file link can download it — no account required. Plus accounts get higher upload limits.',
  },
  {
    q: 'How long are my files stored?',
    a: 'Web uploads are deleted 15 days after their last access (download/view), and the timer resets each time the file is accessed. Anonymous API uploads follow the same 15-day (or 7-day for remote uploads) expiry; files uploaded with an API key are kept until you delete them.',
  },
  {
    q: 'Does Relay support API or remote upload?',
    a: 'Yes — this page documents the full API, including uploading from a remote URL. See the API section in the sidebar.',
  },
  {
    q: 'Can my files be found in search engine results?',
    a: 'No. Uploaded files are not indexed and are only reachable via their unique link.',
  },
];

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-0">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.q} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-[var(--foreground)] cursor-pointer"
            >
              {item.q}
              <span
                className={`shrink-0 text-[var(--c-dim)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              >
                ▾
              </span>
            </button>
            {isOpen && <p className="pb-4 text-sm text-[var(--c-dim)]">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}

function NextButton({ current, onNavigate }: { current: SectionId; onNavigate: (s: SectionId) => void }) {
  const index = SECTION_ORDER.indexOf(current);
  const next = SECTION_ORDER[index + 1];
  if (!next) return null;

  return (
    <div className="flex justify-end pt-8 mt-12 border-t border-[var(--border-subtle)]">
      <button
        onClick={() => onNavigate(next)}
        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-[var(--c-dim)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all duration-200 cursor-pointer"
      >
        Next
        <span className="font-medium text-[var(--foreground)]">{SECTION_LABELS[next]}</span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

export default function ApiDocumentation() {
  const [section, setSection] = useState<SectionId>('welcome');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPlus, setIsPlus] = useState(false);

  useEffect(() => {
    fetch('/api/plus/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setIsPlus(Boolean(data?.plus)))
      .catch(() => {});
  }, []);

  const navigate = (s: SectionId) => {
    setSection(s);
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  };

  const navButtonClass = (active: boolean, indented = false) =>
    `flex items-center gap-2 ${indented ? 'text-xs' : 'text-sm'} py-1.5 px-2 rounded-full w-full text-left cursor-pointer transition-colors ${
      active
        ? 'bg-[var(--surface-card-strong)] text-[var(--foreground)] font-medium'
        : 'text-[var(--c-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
    }`;

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--background)]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden p-2 rounded-md hover:bg-[var(--surface-hover)] cursor-pointer"
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <Link href="/" className="text-base sm:text-lg font-semibold tracking-tight">
              Relay
            </Link>
            <span className="hidden sm:inline text-xs text-[var(--c-dim)]">/ API Docs</span>
          </div>
          {/* mr reserves space for the fixed global theme toggle (top-right,
              see app/components/ThemeToggle.tsx) so it never sits on top of
              these links. */}
          <div className="flex items-center gap-2 sm:gap-3 mr-12 sm:mr-14">
            {isPlus && (
              <Link
                href="/plus/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-[var(--c-dim)] hover:text-[var(--foreground)] rounded-xl transition-all duration-200"
              >
                ← Plus vault
              </Link>
            )}
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-[var(--c-dim)] hover:text-[var(--foreground)] rounded-xl transition-all duration-200"
            >
              Back to app →
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full relative">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`fixed lg:sticky top-[57px] sm:top-[65px] z-40 lg:z-10 w-64 border-r border-[var(--border-subtle)] bg-[var(--background)] p-4 sm:p-6 h-[calc(100vh-57px)] sm:h-[calc(100vh-65px)] overflow-y-auto transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-[var(--c-dim)] uppercase tracking-wider mb-3">
                Introduction
              </h3>
              <button onClick={() => navigate('welcome')} className={navButtonClass(section === 'welcome')}>
                Welcome
              </button>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[var(--c-dim)] uppercase tracking-wider mb-3">API</h3>
              <div className="space-y-1">
                <button onClick={() => navigate('overview')} className={navButtonClass(section === 'overview')}>
                  Overview
                </button>
                <div className="ml-4 border-l border-[var(--border-subtle)] pl-3 space-y-1">
                  {API_SUB_SECTIONS.map((s) => (
                    <button key={s} onClick={() => navigate(s)} className={navButtonClass(section === s, true)}>
                      {SECTION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-12">
          <div className="max-w-3xl">
            {section === 'welcome' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">Welcome</h1>
                <p className="text-[var(--c-dim)] text-lg">Get started with the Relay API.</p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">FAQ</h2>
                <Faq />
              </div>
            )}

            {section === 'overview' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">Overview</h1>
                <p className="text-[var(--c-dim)] text-lg">Learn how to integrate with the Relay API.</p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">Getting started</h2>
                <p className="text-[var(--c-dim)]">
                  The Relay API is organized around REST. It has predictable resource-oriented URLs, accepts
                  JSON or multipart/form-data request bodies, returns JSON-encoded responses, and uses standard
                  HTTP response codes.
                </p>

                <Section title="Authentication">
                  <p className="text-[var(--c-dim)]">
                    Create an API key from the <Link href="/api" className="underline hover:text-[var(--foreground)]">API dashboard</Link>.
                    Include it in the <InlineCode>Authorization</InlineCode> header using the Bearer token format:
                  </p>
                  <CodeBlock code="Authorization: Bearer YOUR_API_KEY" />
                  <p className="text-[var(--c-dim)] text-sm">
                    <strong className="text-[var(--foreground)]">Alternative:</strong> pass the key as{' '}
                    <InlineCode>?api_key=YOUR_API_KEY</InlineCode>.
                  </p>
                  <p className="text-[var(--c-dim)] text-sm">
                    <strong className="text-[var(--foreground)]">Anonymous uploads:</strong> Upload, remote-upload,
                    download, and file-info work without a key. Anonymous uploads are capped at 25GB and expire
                    after 15 days (7 days for remote uploads); they will not appear in <InlineCode>/api/files/list</InlineCode>.
                  </p>
                </Section>

                <Section title="Base URL">
                  <CodeBlock code="https://relay.xstlo.com/api" />
                </Section>

                <Section title="Legacy v1 API">
                  <p className="text-[var(--c-dim)]">
                    Relay also has an existing <InlineCode>/api/v1</InlineCode> developer API (raw R2 object
                    listing, separate from the endpoints on this page). It still works and is unaffected by this
                    documentation, but new integrations should use the endpoints below.
                  </p>
                </Section>
              </div>
            )}

            {section === 'upload' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">Upload a file</h1>
                <p className="text-[var(--c-dim)] text-lg">Upload files to Relay using the API.</p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">Endpoint</h2>
                <Endpoint method="POST" path="https://relay.xstlo.com/api/files/upload" />
                <p className="text-sm text-[var(--c-dim)] mt-2">
                  Direct upload for files under ~4MB. For larger files, use the multipart flow below.
                </p>

                <Section title="Authentication">
                  <p className="text-[var(--c-dim)]">
                    Optional. Include <InlineCode>Authorization: Bearer YOUR_API_KEY</InlineCode> to save the
                    file to your account with no expiration, or omit it for an anonymous upload (25GB max,
                    expires in 15 days).
                  </p>
                </Section>

                <Section title="Request examples">
                  <CodeTabs
                    samples={{
                      curl: `curl -L -X POST https://relay.xstlo.com/api/files/upload \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@/path/to/presentation.pdf"

# Anonymous (not saved to your account, expires in 15 days)
curl -L -X POST https://relay.xstlo.com/api/files/upload \\
  -F "file=@/path/to/presentation.pdf"`,
                      javascript: `const API_KEY = 'YOUR_API_KEY'; // optional
const BASE_URL = 'https://relay.xstlo.com';

async function uploadFile(file, folderId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (folderId) formData.append('folderId', folderId);

  const headers = {};
  if (API_KEY) headers['Authorization'] = \`Bearer \${API_KEY}\`;

  const response = await fetch(\`\${BASE_URL}/api/files/upload\`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}`,
                      python: `import requests

API_KEY = 'YOUR_API_KEY'  # optional
BASE_URL = 'https://relay.xstlo.com'

def upload_file(file_path, folder_id=None):
    headers = {}
    if API_KEY:
        headers['Authorization'] = f'Bearer {API_KEY}'

    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'folderId': folder_id} if folder_id else {}
        response = requests.post(f'{BASE_URL}/api/files/upload', headers=headers, files=files, data=data)

    result = response.json()
    if not result.get('success'):
        raise Exception(result.get('error', 'Upload failed'))
    return result['data']`,
                    }}
                  />
                </Section>

                <Section title="Parameters">
                  <ParamTable
                    rows={[
                      { name: 'file', type: 'File', required: 'Yes', description: 'The file to upload (multipart/form-data)' },
                      { name: 'folderId', type: 'String', required: 'No', description: 'Optional folder ID to organize the file' },
                    ]}
                  />
                </Section>

                <Section title="Response">
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "id": "7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90",
    "name": "presentation.pdf",
    "size": 2458624,
    "url": "https://signed-url...",
    "mimeType": "application/pdf",
    "createdAt": "2026-07-12T12:00:00.000Z",
    "isAnonymous": false,
    "expiresAt": null,
    "shortId": "k7Qm2Xrs"
  }
}`}
                  />
                  <p className="text-[var(--c-dim)] text-sm">
                    <InlineCode>url</InlineCode> is a signed download URL valid for 24 hours — use{' '}
                    <InlineCode>GET /api/files/download/&#123;id&#125;</InlineCode> to get a fresh one later.
                  </p>
                </Section>

                <Section title="Multipart upload (large files)">
                  <p className="text-[var(--c-dim)]">
                    For files at or above the direct-upload threshold, initiate a multipart upload, fetch
                    presigned part URLs, upload each part, then complete it.
                  </p>
                  <Endpoint method="POST" path="https://relay.xstlo.com/api/files/multipart/init" />
                  <CodeBlock
                    code={`// Body: { fileName, fileSize, fileType, folderId? }
// Response: { success, uploadId, key, chunkSize, totalParts }`}
                  />
                  <Endpoint method="POST" path="https://relay.xstlo.com/api/files/multipart/batch-urls" />
                  <CodeBlock
                    code={`// Body: { key, uploadId, totalParts }
// Response: { success, urls: { "1": "https://...", "2": "https://...", ... } }
// PUT each file chunk directly to its URL and collect the returned ETag per part.`}
                  />
                  <Endpoint method="POST" path="https://relay.xstlo.com/api/files/multipart/complete" />
                  <CodeBlock
                    code={`// Body: { key, uploadId, parts: [{ partNumber, etag }], fileName, fileSize, contentType, folderId? }
// Response: { success, file: { id, name, size, url, mimeType, createdAt, isAnonymous, expiresAt, shortId } }`}
                  />
                </Section>

                <Section title="Error response">
                  <CodeBlock code={`{
  "success": false,
  "error": "file is required"
}`} />
                </Section>
              </div>
            )}

            {section === 'remote-upload' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">Remote upload</h1>
                <p className="text-[var(--c-dim)] text-lg">Upload a file from a remote URL to Relay.</p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">Endpoint</h2>
                <Endpoint method="POST" path="https://relay.xstlo.com/api/files/remote-upload" />
                <p className="text-sm text-[var(--c-dim)] mt-2">
                  Relay downloads the file from the given URL server-side and re-uploads it to storage.
                </p>
                <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg p-4 mt-4">
                  <p className="text-sm text-[var(--c-dim)]">
                    <strong className="text-[var(--foreground)]">Known gap:</strong> only the basic, single-shot
                    flow is implemented. rootz-style large-file remote-multipart endpoints
                    (<InlineCode>remote-upload/info</InlineCode>, <InlineCode>remote-upload/multipart/*</InlineCode>)
                    are not yet available — very large remote files may fail if the source doesn&apos;t support the
                    request in one pass.
                  </p>
                </div>

                <Section title="Authentication">
                  <p className="text-[var(--c-dim)]">
                    Optional, same as upload. Anonymous remote uploads are rate-limited to 10 per hour per IP,
                    capped at 25GB, and expire after 7 days.
                  </p>
                </Section>

                <Section title="Request examples">
                  <CodeTabs
                    samples={{
                      curl: `curl -X POST https://relay.xstlo.com/api/files/remote-upload \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://cdn.example.com/standup-recording.mp4",
    "folderId": null
  }'`,
                      javascript: `const response = await fetch('https://relay.xstlo.com/api/files/remote-upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY',
  },
  body: JSON.stringify({ url: 'https://cdn.example.com/standup-recording.mp4' }),
});
const result = await response.json();
if (!result.success) throw new Error(result.error);
console.log(result.data.url);`,
                      python: `import requests

response = requests.post(
    'https://relay.xstlo.com/api/files/remote-upload',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={'url': 'https://cdn.example.com/standup-recording.mp4'},
)
result = response.json()
if not result.get('success'):
    raise Exception(result.get('error'))
print(result['data']['url'])`,
                    }}
                  />
                </Section>

                <Section title="Request body">
                  <ParamTable
                    rows={[
                      { name: 'url', type: 'String', required: 'Yes', description: 'The URL of the file to download and re-upload' },
                      { name: 'folderId', type: 'String', required: 'No', description: 'Optional folder ID (authenticated uploads only)' },
                    ]}
                  />
                </Section>

                <Section title="Response">
                  <p className="text-[var(--c-dim)] text-sm mb-2">Same shape as the upload endpoint&apos;s response.</p>
                  <CodeBlock code={`{
  "success": true,
  "data": {
    "id": "9d2b6e47-1a53-4c88-b6f0-3c7d9a412e65",
    "name": "standup-recording.mp4",
    "size": 52428800,
    "url": "https://signed-url...",
    "mimeType": "video/mp4",
    "createdAt": "2026-07-12T12:00:00.000Z",
    "isAnonymous": true,
    "expiresAt": "2026-07-19T12:00:00.000Z",
    "shortId": "r5Nx9Lqe"
  }
}`} />
                </Section>

                <Section title="Error responses">
                  <CodeBlock code={`// Missing URL
{ "success": false, "error": "No URL provided. Please provide a valid URL in the request body." }

// Rate limit exceeded (anonymous)
{
  "success": false,
  "error": "Rate limit exceeded. Anonymous users can upload 10 files from remote URLs per hour.",
  "rateLimitExceeded": true,
  "resetAt": "2026-07-12T13:45:00.000Z"
}

// Remote server error
{ "success": false, "error": "Failed to download file from URL", "remoteStatus": 403 }`} />
                </Section>
              </div>
            )}

            {section === 'retrieve' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">Retrieve a file</h1>
                <p className="text-[var(--c-dim)] text-lg">Get a signed download URL for a file.</p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">Endpoint</h2>
                <Endpoint method="GET" path="https://relay.xstlo.com/api/files/download/{fileId}" />

                <Section title="Authentication">
                  <p className="text-[var(--c-dim)]">None required. Anyone with the file ID can retrieve a download URL.</p>
                </Section>

                <Section title="Request examples">
                  <CodeTabs
                    samples={{
                      curl: `curl https://relay.xstlo.com/api/files/download/7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90`,
                      javascript: `const res = await fetch('https://relay.xstlo.com/api/files/download/7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90');
const result = await res.json();
console.log('Download URL (expires in 1h):', result.data.url);`,
                      python: `import requests

res = requests.get('https://relay.xstlo.com/api/files/download/7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90')
result = res.json()
print('Download URL (expires in 1h):', result['data']['url'])`,
                    }}
                  />
                </Section>

                <Section title="Parameters">
                  <ParamTable
                    rows={[
                      { name: 'fileId', type: 'String (UUID)', required: 'Yes', description: 'The unique identifier of the file' },
                    ]}
                  />
                </Section>

                <Section title="Response">
                  <CodeBlock code={`{
  "success": true,
  "data": {
    "url": "https://signed-url...",
    "fileName": "presentation.pdf",
    "size": 2458624,
    "mimeType": "application/pdf",
    "expiresIn": 3600,
    "expiresAt": null,
    "downloads": 128,
    "canDelete": false,
    "shortId": "k7Qm2Xrs"
  }
}`} />
                  <p className="text-[var(--c-dim)] text-sm mt-2">
                    Each request increments the file&apos;s download count. The signed URL expires in 1 hour.
                  </p>
                </Section>

                <Section title="Error response">
                  <CodeBlock code={`{ "success": false, "error": "File not found" }`} />
                </Section>
              </div>
            )}

            {section === 'file-info' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">Get file info</h1>
                <p className="text-[var(--c-dim)] text-lg">
                  Get file information by shortId (DDownload-compatible response shape).
                </p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">Endpoint</h2>
                <Endpoint method="GET" path="https://relay.xstlo.com/api/files/info?file_code=shortId1,shortId2" />

                <Section title="Authentication">
                  <p className="text-[var(--c-dim)]">
                    Optional. This endpoint works without a key; authentication does not change the response.
                  </p>
                </Section>

                <Section title="Request examples">
                  <CodeTabs
                    samples={{
                      curl: `curl "https://relay.xstlo.com/api/files/info?file_code=k7Qm2Xrs"

# Multiple files at once
curl "https://relay.xstlo.com/api/files/info?file_code=k7Qm2Xrs,r5Nx9Lqe"`,
                      javascript: `const res = await fetch('https://relay.xstlo.com/api/files/info?file_code=k7Qm2Xrs,r5Nx9Lqe');
const result = await res.json();
result.result.forEach((file) => {
  if (file.status === 200) {
    console.log(\`\${file.filecode}: \${file.name} (\${file.size} bytes)\`);
  } else {
    console.log(\`\${file.filecode}: not found\`);
  }
});`,
                      python: `import requests

res = requests.get('https://relay.xstlo.com/api/files/info', params={'file_code': 'k7Qm2Xrs,r5Nx9Lqe'})
result = res.json()
for file in result['result']:
    if file['status'] == 200:
        print(f"{file['filecode']}: {file['name']} ({file['size']} bytes)")
    else:
        print(f"{file['filecode']}: not found")`,
                    }}
                  />
                </Section>

                <Section title="Parameters">
                  <ParamTable
                    rows={[
                      { name: 'file_code', type: 'String', required: 'Yes', description: 'Comma-separated list of shortIds' },
                    ]}
                  />
                </Section>

                <Section title="Response">
                  <CodeBlock code={`{
  "msg": "OK",
  "server_time": "2026-07-12 12:00:00",
  "status": 200,
  "result": [
    {
      "status": 200,
      "filecode": "k7Qm2Xrs",
      "name": "presentation.pdf",
      "size": "2458624",
      "uploaded": "2026-07-12 10:00:00",
      "download": "128",
      "status_field": "active"
    },
    {
      "status": 200,
      "filecode": "r5Nx9Lqe",
      "name": "standup-recording.mp4",
      "size": "52428800",
      "uploaded": "2026-07-12 11:15:00",
      "download": "7",
      "status_field": "active"
    },
    { "status": 404, "filecode": "unknown123" }
  ]
}`} />
                </Section>

                <Section title="Error response">
                  <CodeBlock code={`{
  "msg": "Bad Request",
  "status": 400,
  "error": "file_code parameter is required (comma-separated shortCodes)"
}`} />
                </Section>
              </div>
            )}

            {section === 'list' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">List files and folders</h1>
                <p className="text-[var(--c-dim)] text-lg">
                  Get a paginated list of files uploaded with your API key, and optionally your folders.
                </p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">Endpoint</h2>
                <Endpoint method="GET" path="https://relay.xstlo.com/api/files/list" />

                <Section title="Authentication">
                  <p className="text-[var(--c-dim)]">
                    Required. <InlineCode>Authorization: Bearer YOUR_API_KEY</InlineCode> with the{' '}
                    <InlineCode>list</InlineCode> permission. Only files uploaded with that key are returned —
                    anonymous uploads never appear here.
                  </p>
                </Section>

                <Section title="Request examples">
                  <CodeTabs
                    samples={{
                      curl: `curl https://relay.xstlo.com/api/files/list \\
  -H "Authorization: Bearer YOUR_API_KEY"

# With pagination and a folder filter
curl "https://relay.xstlo.com/api/files/list?page=2&limit=25&folderId=null" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
                      javascript: `const res = await fetch('https://relay.xstlo.com/api/files/list?page=1&limit=50', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
});
const result = await res.json();
console.log(\`\${result.pagination.total} files\`);
result.data.forEach((f) => console.log(f.name, f.size));`,
                      python: `import requests

res = requests.get(
    'https://relay.xstlo.com/api/files/list',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    params={'page': 1, 'limit': 50},
)
result = res.json()
print(f"{result['pagination']['total']} files")
for f in result['data']:
    print(f['name'], f['size'])`,
                    }}
                  />
                </Section>

                <Section title="Query parameters">
                  <ParamTable
                    requiredHeader="Default"
                    rows={[
                      { name: 'page', type: 'Integer', required: '1', description: 'Page number' },
                      { name: 'limit', type: 'Integer', required: '50', description: 'Files per page (max 200)' },
                      { name: 'folderId', type: 'String', required: '—', description: 'Filter by folder ID; use "null" for root' },
                      { name: 'includeFolders', type: 'Boolean', required: 'true', description: 'Include a "folders" array when listing the root' },
                    ]}
                  />
                </Section>

                <Section title="Response">
                  <CodeBlock code={`{
  "success": true,
  "data": [
    {
      "id": "7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90",
      "name": "presentation.pdf",
      "size": 2458624,
      "mime_type": "application/pdf",
      "path": "d/api/<key-id>/172.../presentation.pdf",
      "short_id": "k7Qm2Xrs",
      "folder_id": null,
      "owner_id": "<key-id>",
      "is_anonymous": false,
      "expires_at": null,
      "created_at": "2026-07-12T12:00:00.000Z",
      "updated_at": "2026-07-12T12:00:00.000Z",
      "download_count": 128
    }
  ],
  "folders": [
    { "id": "folder-8f3d2a91", "name": "Client Deliverables", "parent_id": null, "owner_id": null, "created_at": "...", "updated_at": "..." }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 }
}`} />
                  <p className="text-[var(--c-dim)] text-sm mt-2">
                    Relay&apos;s folders are a flat, shared list (no nesting yet), so <InlineCode>parent_id</InlineCode>{' '}
                    is always <InlineCode>null</InlineCode> and <InlineCode>folders</InlineCode> is only included
                    when listing the root.
                  </p>
                </Section>

                <h2 className="text-2xl font-semibold mt-12 mb-4">List folders (dedicated endpoint)</h2>
                <p className="text-[var(--c-dim)]">To list only folders, use the folders endpoint with the same API key.</p>
                <Endpoint method="GET" path="https://relay.xstlo.com/api/folders/list" />
                <p className="text-[var(--c-dim)] text-sm mt-2">
                  Query params: <InlineCode>parentId</InlineCode> (always empty in the flat model — a non-root
                  value returns zero results), <InlineCode>page</InlineCode>, <InlineCode>limit</InlineCode>,{' '}
                  <InlineCode>search</InlineCode>. Response: <InlineCode>{`{ success, data: [folders], pagination }`}</InlineCode>.
                  Each folder includes <InlineCode>id</InlineCode>, <InlineCode>name</InlineCode>,{' '}
                  <InlineCode>parent_id</InlineCode>, <InlineCode>file_count</InlineCode>, <InlineCode>total_size</InlineCode>{' '}
                  (omitted while searching).
                </p>

                <Section title="Error response">
                  <CodeBlock code={`{ "success": false, "error": "API key is required. Provide it via Authorization header or api_key query parameter." }`} />
                </Section>
              </div>
            )}

            {section === 'delete' && (
              <div>
                <h1 className="text-4xl font-bold mb-3">Delete a file</h1>
                <p className="text-[var(--c-dim)] text-lg">Permanently delete a file.</p>

                <h2 className="text-2xl font-semibold mt-12 mb-4">Endpoint</h2>
                <Endpoint method="DELETE" path="https://relay.xstlo.com/api/files/delete?fileId=FILE_ID" />

                <Section title="Authentication">
                  <p className="text-[var(--c-dim)]">
                    Required, either <InlineCode>Authorization: Bearer YOUR_API_KEY</InlineCode> for a file owned
                    by that key, or a deletion <InlineCode>token</InlineCode> for anonymous uploads:{' '}
                    <InlineCode>?fileId=FILE_ID&amp;token=DELETION_TOKEN</InlineCode>.
                  </p>
                </Section>

                <Section title="Request examples">
                  <CodeTabs
                    samples={{
                      curl: `curl -X DELETE "https://relay.xstlo.com/api/files/delete?fileId=7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90" \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Anonymous file, using its deletion token instead
curl -X DELETE "https://relay.xstlo.com/api/files/delete?fileId=9d2b6e47-1a53-4c88-b6f0-3c7d9a412e65&token=YOUR_DELETION_TOKEN"`,
                      javascript: `const res = await fetch(
  \`https://relay.xstlo.com/api/files/delete?fileId=\${fileId}\`,
  { method: 'DELETE', headers: { 'Authorization': 'Bearer YOUR_API_KEY' } }
);
const result = await res.json();
if (!result.success) throw new Error(result.error);`,
                      python: `import requests

res = requests.delete(
    'https://relay.xstlo.com/api/files/delete',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    params={'fileId': file_id},
)
result = res.json()
if not result.get('success'):
    raise Exception(result.get('error'))`,
                    }}
                  />
                </Section>

                <Section title="Query parameters">
                  <ParamTable
                    rows={[
                      { name: 'fileId', type: 'String (UUID)', required: 'Yes', description: 'The file to delete' },
                      { name: 'token', type: 'String', required: 'No*', description: 'Deletion token, required only for anonymous files without an API key' },
                    ]}
                  />
                </Section>

                <Section title="Response">
                  <CodeBlock code={`{ "success": true, "message": "File deleted successfully" }`} />
                </Section>

                <Section title="Error responses">
                  <CodeBlock code={`{ "success": false, "error": "File not found" }
{ "success": false, "error": "Unauthorized to delete this file" }
{ "success": false, "error": "File ID is required" }`} />
                </Section>
              </div>
            )}

            <NextButton current={section} onNavigate={navigate} />
          </div>
        </main>
      </div>
    </div>
  );
}
