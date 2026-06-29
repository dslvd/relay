import { NextResponse } from 'next/server';

export function notFoundHtml(heading: string, message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
    <style>
      @keyframes fade-up {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50%       { transform: translateY(-8px); }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background:
          radial-gradient(ellipse at 25% 20%, rgba(20,10,40,0.9) 0%, transparent 60%),
          radial-gradient(ellipse at 75% 80%, rgba(10,20,30,0.8) 0%, transparent 60%),
          #0a0a0a;
        color: #eef1f6;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2rem;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.3rem 0.85rem;
        border-radius: 999px;
        border: 1px solid rgba(126,244,203,0.2);
        background: rgba(126,244,203,0.06);
        color: #7ef4cb;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 1.8rem;
        animation: fade-up 0.6s ease both;
      }
      .badge-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #7ef4cb;
        box-shadow: 0 0 6px rgba(126,244,203,0.8);
      }
      .number {
        font-size: clamp(6rem, 20vw, 12rem);
        font-weight: 700;
        line-height: 0.9;
        letter-spacing: -0.04em;
        background: linear-gradient(160deg, #ffffff 0%, #7ef4cb 40%, rgba(126,244,203,0.5) 80%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 0.5rem;
        animation: float 5s ease-in-out infinite, fade-up 0.5s ease both;
        user-select: none;
      }
      h1 {
        font-size: clamp(1rem, 3vw, 1.4rem);
        font-weight: 600;
        color: #eef1f6;
        letter-spacing: -0.02em;
        margin-bottom: 0.65rem;
        animation: fade-up 0.6s 0.1s ease both;
      }
      p {
        font-size: 0.9rem;
        color: #8a92a1;
        max-width: 340px;
        line-height: 1.6;
        margin-bottom: 2.5rem;
        animation: fade-up 0.6s 0.2s ease both;
      }
      a {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.7rem 1.6rem;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: #eef1f6;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.14);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        text-decoration: none;
        transition: background 0.2s, border-color 0.2s, transform 0.15s;
        animation: fade-up 0.6s 0.3s ease both;
      }
      a:hover {
        background: rgba(255,255,255,0.12);
        border-color: rgba(255,255,255,0.22);
        transform: translateY(-2px);
      }
      .divider {
        width: 1px;
        height: 14px;
        background: rgba(255,255,255,0.2);
        flex-shrink: 0;
      }
      .code {
        font-size: 0.7rem;
        font-weight: 700;
        color: #7ef4cb;
      }
    </style>
  </head>
  <body>
    <div class="badge"><span class="badge-dot"></span>Error</div>
    <div class="number">404</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <a href="/">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Back to Relay
      <span class="divider"></span>
      <span class="code">404</span>
    </a>
  </body>
</html>`;
}

export function notFoundResponse(heading: string, message: string): NextResponse {
  return new NextResponse(notFoundHtml(heading, message), {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
