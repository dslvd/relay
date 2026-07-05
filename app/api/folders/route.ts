import { NextRequest, NextResponse } from 'next/server';
import { createFolder, listFolders } from '@/app/lib/data/folder-store';

export const dynamic = 'force-dynamic';

// GET /api/folders — list all folders. No auth: folder names aren't
// sensitive on their own, matching the rest of this app's anonymous-upload
// model (a file's URL, not a login, is the capability that protects it).
export async function GET() {
  try {
    const folders = await listFolders();
    return NextResponse.json({ success: true, data: { folders } });
  } catch (error) {
    console.error('Error listing folders:', error);
    return NextResponse.json({ error: 'Failed to list folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const folder = await createFolder(name);
    return NextResponse.json({ success: true, data: { folder } });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
