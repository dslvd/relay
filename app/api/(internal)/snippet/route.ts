import { NextRequest, NextResponse } from 'next/server';
import { buildObjectKey, putObjectText } from '@/app/lib/storage/r2-storage';
import { addUploadRecord, getPlusStorageUsedBytes, type UploadRecord } from '@/app/lib/data/upload-history-store';
import { RETENTION_MS } from '@/app/lib/storage/retention';
import { getPlusUserFromSession } from '@/app/lib/auth/plus-auth';
import { isBlacklisted } from '@/app/lib/data/abuse-store';
import { checkRateLimit } from '@/app/lib/security/rate-limit';
import { PLUS_STORAGE_LIMIT_BYTES } from '@/app/lib/plan-limits';

const MAX_SNIPPETS_PER_HOUR = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_SNIPPET_BYTES = 1 * 1024 * 1024; // 1MB
const PLUS_COOKIE_NAME = 'plus_auth';

// Maps a snippet's language to a file extension, used both to name the
// object for the /d/ share page's extension-based preview logic and as a
// fallback filename when the caller doesn't supply one.
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'py',
  go: 'go',
  rust: 'rs',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  ruby: 'rb',
  php: 'php',
  swift: 'swift',
  kotlin: 'kt',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yml',
  markdown: 'md',
  bash: 'sh',
  sql: 'sql',
  plaintext: 'txt',
};

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]/g, '_').trim().slice(0, 200);
}

function deriveFilename(requested: string, language?: string): string {
  const cleaned = sanitizeFilename(requested);
  if (cleaned) return cleaned;
  const ext = (language && LANGUAGE_EXTENSIONS[language]) || 'txt';
  return `snippet.${ext}`;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';

  const rateLimit = await checkRateLimit(`snippet:${ip}`, MAX_SNIPPETS_PER_HOUR, RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const content = typeof body?.content === 'string' ? body.content : '';
    const language = typeof body?.language === 'string' ? body.language.slice(0, 40) : undefined;
    const requestedFilename = typeof body?.filename === 'string' ? body.filename : '';

    if (!content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const byteSize = Buffer.byteLength(content, 'utf8');
    if (byteSize > MAX_SNIPPET_BYTES) {
      return NextResponse.json({ error: 'Snippet is too large (1MB max)' }, { status: 413 });
    }

    const filename = deriveFilename(requestedFilename, language);

    if (await isBlacklisted(ip, filename)) {
      return NextResponse.json({ error: 'Upload blocked' }, { status: 403 });
    }

    const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
    const plusUser = token ? await getPlusUserFromSession(token) : null;

    if (plusUser) {
      const used = await getPlusStorageUsedBytes(plusUser.id);
      if (used + byteSize > PLUS_STORAGE_LIMIT_BYTES) {
        return NextResponse.json({ error: 'Plus storage limit reached (80GB)' }, { status: 413 });
      }
    }

    const objectKey = buildObjectKey(filename);
    await putObjectText({ objectKey, content, contentType: 'text/plain; charset=utf-8' });

    const uniqueName = objectKey.split('/').pop() || filename;
    const url = `${request.nextUrl.origin}/d/${uniqueName}`;
    const now = Date.now();

    const record: UploadRecord = {
      url,
      filename,
      size: byteSize,
      timestamp: now,
      lastAccessTime: now,
      expiresAt: now + RETENTION_MS,
      ip,
      ownerId: plusUser?.id,
      ownerEmail: plusUser?.email,
      kind: 'snippet',
      language,
    };

    await addUploadRecord(record, plusUser ? 'plus' : 'public');

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Failed to create snippet:', error);
    return NextResponse.json({ error: 'Failed to create snippet' }, { status: 500 });
  }
}
