import { NextRequest, NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';

const ADMIN_COOKIE_NAME = 'admin_auth';

function requireAdmin(request: NextRequest): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!cookieValue || cookieValue !== adminPassword) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null;
}

async function deleteAllBlobs(): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await list({
      limit: 1000,
      cursor
    });

    for (const blob of response.blobs) {
      await del(blob.url);
      deleted += 1;
    }

    cursor = response.cursor;
    hasMore = response.hasMore;
  }

  return deleted;
}

export async function DELETE(request: NextRequest) {
  try {
    const authError = requireAdmin(request);
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Convert the proxied URL to the actual blob storage URL
    // url format: http://localhost:3000/d/filename.ext or https://relaycdn.vercel.app/d/filename.ext
    // We need: https://rcltxppgseuupozb.public.blob.vercel-storage.com/d/filename.ext
    const urlObj = new URL(url);
    const blobUrl = `https://rcltxppgseuupozb.public.blob.vercel-storage.com${urlObj.pathname}`;

    // Delete from Vercel Blob storage
    await del(blobUrl);

    // Remove from history
    if (typeof global.uploadHistory !== 'undefined') {
      global.uploadHistory = (global.uploadHistory as any[]).filter(
        (record: any) => record.url !== url
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'File deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAdmin(request);
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'clear_all') {
      const deleted = await deleteAllBlobs();
      global.uploadHistory = [];

      return NextResponse.json({ 
        success: true,
        message: 'All files deleted successfully',
        deleted
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in admin operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform operation' },
      { status: 500 }
    );
  }
}
