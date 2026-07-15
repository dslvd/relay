import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/lib/auth/api-auth';
import { deleteObject } from '@/app/lib/storage/r2-storage';
import { getFileRecordById, deleteFileRecord } from '@/app/lib/data/api-file-store';

// DELETE /api/files/delete?fileId=&token= - permanently delete a file (rootz-compatible)
export async function DELETE(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get('fileId');
    const token = request.nextUrl.searchParams.get('token');

    if (!fileId) {
      return NextResponse.json({ success: false, error: 'File ID is required' }, { status: 400 });
    }

    const record = await getFileRecordById(fileId);
    if (!record) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const auth = await authenticateApiKey(request);
    const ownedByApiKey = auth.success && record.ownerId === auth.apiKey!.id;
    const ownedByToken = Boolean(record.deletionToken) && token === record.deletionToken;

    if (!ownedByApiKey && !ownedByToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized to delete this file' }, { status: 403 });
    }

    await deleteObject(record.objectKey);
    await deleteFileRecord(record.id);

    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Files delete error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete file' }, { status: 500 });
  }
}
