import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = params;
    const pathname = `d/${path.join('/')}`;
    
    // Construct the Vercel Blob storage URL
    const blobUrl = `https://rcltxppgseuupozb.public.blob.vercel-storage.com/${pathname}`;
    
    // Fetch and proxy the file content
    const response = await fetch(blobUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Get the file content
    if (!response.body) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Return the file with proper headers
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': response.headers.get('Content-Length') || '',
        'Cache-Control': 'public, max-age=604800, must-revalidate',
      }
    });
  } catch (error) {
    console.error('Error proxying file:', error);
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = params;
    const pathname = `d/${path.join('/')}`;
    const blobUrl = `https://rcltxppgseuupozb.public.blob.vercel-storage.com/${pathname}`;
    
    // Check if file exists
    const response = await fetch(blobUrl, { method: 'HEAD' });
    
    if (response.ok) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Length': response.headers.get('Content-Length') || '0',
        }
      });
    }
    
    return new NextResponse(null, { status: 404 });
  } catch (error) {
    return new NextResponse(null, { status: 404 });
  }
}
