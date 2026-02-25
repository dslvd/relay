import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, listAllObjects, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory, saveUploadHistory } from '@/app/lib/data/upload-history-store';

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
  let deleted = 0;

  const objects = await listAllObjects('d/');
  for (const object of objects) {
    if (!object.Key) {
      continue;
    }

    try {
      await deleteObject(object.Key);
      deleted += 1;
    } catch (error) {
      console.error('Failed to delete object:', object.Key, error);
    }
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

    const objectKey = toObjectKeyFromAppUrl(url);
    if (!objectKey) {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    await deleteObject(objectKey);

    const publicHistory = await loadUploadHistory('public');
    const premiumHistory = await loadUploadHistory('premium');
    await saveUploadHistory(publicHistory.filter((record) => record.url !== url), 'public');
    await saveUploadHistory(premiumHistory.filter((record) => record.url !== url), 'premium');

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
      await saveUploadHistory([], 'public');
      await saveUploadHistory([], 'premium');

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
