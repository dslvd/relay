'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import LordIcon from './components/LordIcon';

export default function NotFound() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COUNT = 60;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      o: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(126,244,203,${p.o})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes nf-glitch {
          0%, 90%, 100% {
            text-shadow:
              0 0 60px rgba(126,244,203,0.25),
              0 0 120px rgba(126,244,203,0.1);
            transform: translate(0, 0) skewX(0deg);
          }
          92% {
            text-shadow:
              -4px 0 rgba(255,50,100,0.7),
              4px 0 rgba(50,100,255,0.7),
              0 0 60px rgba(126,244,203,0.25);
            transform: translate(-3px, 1px) skewX(-1deg);
          }
          94% {
            text-shadow:
              4px 0 rgba(255,50,100,0.7),
              -4px 0 rgba(50,100,255,0.7),
              0 0 80px rgba(126,244,203,0.35);
            transform: translate(3px, -1px) skewX(1deg);
          }
          96% {
            text-shadow:
              -2px 0 rgba(255,50,100,0.5),
              2px 0 rgba(50,100,255,0.5),
              0 0 60px rgba(126,244,203,0.2);
            transform: translate(-1px, 0) skewX(0deg);
          }
          98% {
            text-shadow:
              0 0 100px rgba(126,244,203,0.45);
            transform: translate(0, 0);
          }
        }
        @keyframes nf-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes nf-fade-up {
          from { opacity: 0; transform: translateY(24px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0);   }
        }
        @keyframes nf-orbit {
          from { transform: rotate(0deg) translateX(90px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(90px) rotate(-360deg); }
        }
        @keyframes nf-scan {
          0%   { top: -2px; opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { top: 100%; opacity: 0; }
        }
        .nf-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          font-family: var(--font-sora, system-ui, sans-serif);
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 25% 20%, rgba(20,10,40,0.9) 0%, transparent 60%),
            radial-gradient(ellipse at 75% 80%, rgba(10,20,30,0.8) 0%, transparent 60%),
            #0a0a0a;
        }
        .nf-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .nf-glow-ring {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          border: 1px solid rgba(126,244,203,0.06);
          box-shadow: 0 0 80px rgba(126,244,203,0.04) inset;
          pointer-events: none;
        }
        .nf-orbit-dot {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #7ef4cb;
          box-shadow: 0 0 8px rgba(126,244,203,0.8), 0 0 16px rgba(126,244,203,0.4);
          animation: nf-orbit 6s linear infinite;
        }
        .nf-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }
        .nf-badge {
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
          animation: nf-fade-up 0.6s ease both;
        }
        .nf-badge-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #7ef4cb;
          box-shadow: 0 0 6px rgba(126,244,203,0.8);
          animation: nf-float 2s ease-in-out infinite;
        }
        .nf-number {
          font-size: clamp(7rem, 22vw, 14rem);
          font-weight: 700;
          line-height: 0.9;
          letter-spacing: -0.04em;
          background: linear-gradient(160deg, #ffffff 0%, #7ef4cb 40%, rgba(126,244,203,0.5) 80%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation:
            nf-glitch 5s ease-in-out infinite,
            nf-float 5s ease-in-out infinite,
            nf-fade-up 0.5s ease both;
          margin-bottom: 0.5rem;
          position: relative;
          user-select: none;
        }
        .nf-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(126,244,203,0.5), transparent);
          animation: nf-scan 4s linear infinite;
          pointer-events: none;
        }
        .nf-title {
          font-size: clamp(1.1rem, 3vw, 1.5rem);
          font-weight: 600;
          color: #eef1f6;
          letter-spacing: -0.02em;
          margin: 0 0 0.65rem;
          animation: nf-fade-up 0.6s 0.1s ease both;
        }
        .nf-sub {
          font-size: 0.9rem;
          color: #8a92a1;
          max-width: 340px;
          line-height: 1.6;
          margin: 0 0 2.5rem;
          animation: nf-fade-up 0.6s 0.2s ease both;
        }
        .nf-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.6rem;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: 0.01em;
          color: #eef1f6;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s;
          cursor: pointer;
          animation: nf-fade-up 0.6s 0.3s ease both;
        }
        .nf-btn:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.22);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .nf-btn:active {
          transform: translateY(0px) scale(0.97);
        }
        .nf-divider {
          width: 1px;
          height: 14px;
          background: rgba(255,255,255,0.2);
        }
        .nf-btn-code {
          font-size: 0.7rem;
          font-weight: 700;
          color: #7ef4cb;
          opacity: 0.9;
        }
        .nf-footer {
          position: absolute;
          bottom: 1.5rem;
          font-size: 0.7rem;
          color: rgba(138,146,161,0.5);
          letter-spacing: 0.04em;
          animation: nf-fade-up 0.6s 0.5s ease both;
        }
      `}</style>

      <div className="nf-root">
        <canvas ref={canvasRef} className="nf-canvas" aria-hidden="true" />

        {/* Orbit ring + dot */}
        <div className="nf-glow-ring" aria-hidden="true">
          <div className="nf-orbit-dot" />
        </div>

        <div className="nf-content">
          <div className="nf-badge">
            <span className="nf-badge-dot" />
            Error
          </div>

          <div style={{ position: 'relative' }}>
            <div className="nf-number">404</div>
            <div className="nf-scan-line" aria-hidden="true" />
          </div>

          <h1 className="nf-title">Page not found</h1>
          <p className="nf-sub">
            This page doesn&apos;t exist or was removed. If you&apos;re looking for a file, it may have expired.
          </p>

          <Link href="/" className="nf-btn">
            <LordIcon name="arrowRight" size={13} mirror />
            Back to Relay
            <div className="nf-divider" />
            <span className="nf-btn-code">404</span>
          </Link>
        </div>

        {/* <div className="nf-footer">relay &nbsp;·&nbsp; page not found</div> */}
      </div>
    </>
  );
}
