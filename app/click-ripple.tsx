'use client';

import { useEffect } from 'react';

export default function ClickRipple() {
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handlePointerDown = (event: PointerEvent) => {
      if (prefersReducedMotion) {
        return;
      }

      const burst = document.createElement('span');
      burst.className = 'click-burst';
      burst.style.left = `${event.clientX}px`;
      burst.style.top = `${event.clientY}px`;

      const wave = document.createElement('span');
      wave.className = 'click-burst__wave';
      burst.appendChild(wave);

      const glow = document.createElement('span');
      glow.className = 'click-burst__glow';
      burst.appendChild(glow);

      for (let i = 0; i < 7; i++) {
        const spark = document.createElement('span');
        spark.className = 'click-burst__spark';
        const angle = (Math.PI * 2 * i) / 7;
        const distance = 16 + Math.round(Math.random() * 16);
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        spark.style.setProperty('--spark-x', `${dx.toFixed(2)}px`);
        spark.style.setProperty('--spark-y', `${dy.toFixed(2)}px`);
        spark.style.setProperty('--spark-delay', `${(i * 0.012).toFixed(3)}s`);
        burst.appendChild(spark);
      }

      document.body.appendChild(burst);

      window.setTimeout(() => {
        burst.remove();
      }, 760);
    };

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return null;
}
