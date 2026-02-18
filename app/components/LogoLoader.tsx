'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export default function LogoLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    let animationId: number;
    let sparkInterval: NodeJS.Timeout;

    const createSparks = (x: number, y: number) => {
      const sparkCount = 8;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount;
        const velocity = 3 + Math.random() * 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 1,
          maxLife: 1,
          size: 6 + Math.random() * 4,
        });
      }
    };

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life -= 0.02;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(59, 130, 246, ${p.life * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Create sparks periodically
    sparkInterval = setInterval(() => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      createSparks(centerX, centerY);
    }, 600);

    // Handle window resize
    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(sparkInterval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <main className="min-h-screen grid grid-cols-1">
      <section className="relative flex items-center justify-center min-h-screen px-4 py-8 sm:p-8">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-50"
          aria-hidden="true"
        />
        <div className="logo-loader-container relative w-[120px] h-[120px]">
          <div className="absolute inset-0 opacity-20">
            <Image
              alt="Loading..."
              width={120}
              height={120}
              src="/images/rootz-black-transparent.png"
              className="dark:invert"
              priority
            />
          </div>
          <div className="absolute inset-0 logo-fill-animation">
            <Image
              alt="Loading..."
              width={120}
              height={120}
              src="/images/rootz-black-transparent.png"
              className="dark:invert"
              priority
            />
          </div>
        </div>
      </section>
    </main>
  );
}
