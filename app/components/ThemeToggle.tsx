'use client';

import { useState } from 'react';
import { useTheme } from './ThemeProvider';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width={17} height={17} style={{ display: 'block' }}>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="2.5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2.5" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="19" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="5.64" y1="5.64" x2="7.41" y2="7.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16.59" y1="16.59" x2="18.36" y2="18.36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="5.64" y1="18.36" x2="7.41" y2="16.59" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16.59" y1="7.41" x2="18.36" y2="5.64" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width={17} height={17} style={{ display: 'block' }}>
      <path
        d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 500);
    toggleTheme();
  };

  return (
    <button
      className="theme-toggle-btn"
      onClick={handleClick}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        border: 'none',
        background: 'transparent',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        color: isDark ? '#ffffff' : '#000000',
        boxShadow: 'none',
      }}
    >
      <span className={`theme-icon${animating ? ' theme-icon--flipping' : ''}`}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
