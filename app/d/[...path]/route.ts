import { NextRequest, NextResponse } from 'next/server';

function fileNotFoundResponse(): NextResponse {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>File not found</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0b0d;
        --card: rgba(255, 255, 255, 0.06);
        --border: rgba(255, 255, 255, 0.16);
        --text: #f5f5f5;
        --muted: rgba(245, 245, 245, 0.62);
        --accent: #ffffff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Open Sans", system-ui, -apple-system, sans-serif;
        background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08), transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05), transparent 42%),
          var(--bg);
        color: var(--text);
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
      }
      .shell {
        width: min(880px, 92vw);
        border-radius: 28px;
        border: 1px solid var(--border);
        background: var(--card);
        backdrop-filter: blur(18px);
        padding: 3.2rem;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
      }
      .eyebrow {
        font-size: 0.8rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h1 {
        margin: 0.8rem 0 0.6rem;
        font-size: clamp(2rem, 4vw, 3.1rem);
        letter-spacing: -0.02em;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 1rem;
      }
      .actions {
        margin-top: 2.2rem;
        display: flex;
        gap: 0.9rem;
        flex-wrap: wrap;
      }
      a.button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.2rem;
        border-radius: 999px;
        border: 1px solid var(--accent);
        color: #0a0a0a;
        background: var(--accent);
        text-decoration: none;
        font-weight: 700;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      a.button:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(255, 255, 255, 0.15);
      }
      .ghost {
        border-color: var(--border);
        background: transparent;
        color: var(--text);
      }
      .divider {
        margin-top: 2rem;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      }
      .hint {
        margin-top: 1.4rem;
        font-size: 0.85rem;
        color: rgba(245, 245, 245, 0.5);
      }
    </style>
  </head>
  <body>
    <section class="shell">
      <div class="eyebrow">404</div>
      <h1>File not found</h1>
      <p>The link points to a file that no longer exists or never did.</p>
      <div class="actions">
        <a class="button" href="/">Back to home</a>
        <a class="button ghost" href="/">Upload a new file</a>
      </div>
      <div class="divider"></div>
      <div class="hint">If this keeps happening, ask the sender to re-upload the file.</div>
    </section>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathname = `d/${path.join('/')}`;
    
    // Construct the Vercel Blob storage URL
    const blobUrl = `https://rcltxppgseuupozb.public.blob.vercel-storage.com/${pathname}`;
    
    // Fetch and proxy the file content
    const response = await fetch(blobUrl);
    
    if (!response.ok) {
      return fileNotFoundResponse();
    }
    
    // Get the file content
    if (!response.body) {
      return fileNotFoundResponse();
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
    return fileNotFoundResponse();
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
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
