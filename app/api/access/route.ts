import { NextRequest, NextResponse } from 'next/server';
import { updateLastAccessTime } from '@/app/lib/storage/retention';

export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json();
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    await updateLastAccessTime(filename);

    return NextResponse.json({ 
      success: true,
      message: 'Last access time updated' 
    });
  } catch (error) {
    console.error('Error updating access time:', error);
    return NextResponse.json(
      { error: 'Failed to update access time' },
      { status: 500 }
    );
  }
}
