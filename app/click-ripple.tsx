'use client';

import { useEffect } from 'react';

export default function ClickRipple() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const ripple = document.createElement('span');
      ripple.className = 'click-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;

      document.body.appendChild(ripple);

      const remove = () => {
        ripple.removeEventListener('animationend', remove);
        ripple.remove();
      };

      ripple.addEventListener('animationend', remove);
    };

    document.addEventListener('click', handleClick, { passive: true });

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
