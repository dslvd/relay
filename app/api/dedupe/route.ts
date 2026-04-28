import { NextRequest, NextResponse } from 'next/server';
import {
  deleteFileHashRecord,
  loadFileHashRecord,
  saveFileHashRecord,
} from '@/app/lib/data/file-hash-store';
import { loadAliasRecord, saveAliasRecord } from '@/app/lib/data/file-alias-store';
import { normalizeObjectKey, objectExists } from '@/app/lib/storage/r2-storage';

function randomKey(length = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

function extractSafeExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  const ext = parts.pop() || '';
  if (!ext) return '';
  if (!/^[a-zA-Z0-9]{1,10}$/.test(ext)) return '';
  return ext.toLowerCase();
}

async function allocateAliasKey(filename: string): Promise<string | null> {
  const ext = extractSafeExtension(filename);

  for (let i = 0; i < 8; i++) {
    const base = randomKey(9);
    const key = ext ? `${base}.${ext}` : base;

    const existingAlias = await loadAliasRecord(key);
    if (existingAlias) {
      continue;
    }

    const existingObject = await objectExists(`d/${key}`);
    if (existingObject) {
      continue;
    }

    return key;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const commit = Boolean(body?.commit);
    const hash = typeof body?.hash === 'string' ? body.hash.trim() : '';
    const objectKeyRaw = typeof body?.objectKey === 'string' ? body.objectKey.trim() : '';
    const filename = typeof body?.filename === 'string' ? body.filename.trim() : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : undefined;
    const size = Number(body?.size);

    if (!hash) {
      return NextResponse.json({ error: 'hash is required' }, { status: 400 });
    }

    if (commit) {
      if (!objectKeyRaw) {
        return NextResponse.json({ error: 'objectKey is required' }, { status: 400 });
      }

      const objectKey = normalizeObjectKey(objectKeyRaw);
      const record = {
        objectKey,
        size: Number.isFinite(size) ? size : 0,
        contentType,
        filename,
        createdAt: Date.now(),
      };

      const existing = await loadFileHashRecord(hash);
      if (existing?.objectKey === objectKey) {
        return NextResponse.json({ success: true, reused: true });
      }

      if (existing?.objectKey) {
        const stillExists = await objectExists(existing.objectKey);
        if (stillExists) {
          return NextResponse.json({ success: true, reused: true });
        }
      }

      await saveFileHashRecord(hash, record);
      return NextResponse.json({ success: true, reused: false });
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'size is required' }, { status: 400 });
    }

    const existing = await loadFileHashRecord(hash);
    if (!existing || existing.size !== size) {
      return NextResponse.json({ success: true, duplicate: false });
    }

    const exists = await objectExists(existing.objectKey);
    if (!exists) {
      await deleteFileHashRecord(hash);
      return NextResponse.json({ success: true, duplicate: false });
    }

    const aliasKey = await allocateAliasKey(filename || 'file');
    if (!aliasKey) {
      return NextResponse.json({ error: 'Failed to allocate alias key' }, { status: 500 });
    }

    await saveAliasRecord(aliasKey, existing.objectKey);

    const downloadUrl = `${request.nextUrl.origin}/download/${aliasKey}`;
    return NextResponse.json({
      success: true,
      duplicate: true,
      data: {
        aliasKey,
        downloadUrl,
      },
    });
  } catch (error) {
    console.error('Dedupe error:', error);
    return NextResponse.json({ error: 'Failed to process dedupe request' }, { status: 500 });
  }
}
