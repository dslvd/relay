'use client';

import { useEffect, useState } from 'react';
import HomeClassic from './HomeClassic';
import HomeTerminal from './HomeTerminal';

type HomeStyle = 'classic' | 'terminal';

const STORAGE_KEY = 'relay:homeStyle';

export default function HomeSwitcher({ initialStyle }: { initialStyle: HomeStyle }) {
  const [style, setStyle] = useState<HomeStyle>(initialStyle);

  // Deliberately deferred to an effect rather than a lazy useState initializer:
  // reading localStorage during render would make the client's first render
  // diverge from the server-rendered HTML (which has no access to it),
  // triggering a hydration mismatch. Applying the stored preference one tick
  // after hydration trades a brief flash for a guaranteed-consistent mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      if (stored === 'classic' || stored === 'terminal') setStyle(stored);
    } catch {
      // Storage blocked (private mode, etc.) — just keep the route default.
    }
  }, []);

  const switchTo = (next: HomeStyle) => {
    setStyle(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference just won't persist across visits — switching still works.
    }
  };

  return (
    <>
      {style === 'classic' ? <HomeClassic /> : <HomeTerminal />}

      <style>{`
        .hsw-pill {
          /* Top-left: bottom-left is already claimed by the site's policy
             menu (PolicyMenu, see globals.css .footer-link) and bottom-right
             by upload toasts, so this is the one corner nothing else uses. */
          position: fixed;
          top: 1.1rem;
          left: 1.1rem;
          z-index: 60;
          display: flex;
          gap: 1px;
          padding: 2px;
          background: rgba(10, 10, 10, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .hsw-btn {
          appearance: none;
          border: none;
          border-radius: 999px;
          background: transparent;
          color: rgba(255, 255, 255, 0.55);
          font-size: 0.58rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 0.15rem 0.4rem;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .hsw-btn:hover { color: rgba(255, 255, 255, 0.85); }
        .hsw-btn[aria-pressed="true"] {
          background: #fff;
          color: #000;
        }
        @media (max-width: 480px) {
          .hsw-pill { top: 0.7rem; left: 0.7rem; }
        }
      `}</style>
      <div className="hsw-pill" role="group" aria-label="Homepage style">
        <button
          type="button"
          className="hsw-btn"
          aria-pressed={style === 'classic'}
          onClick={() => switchTo('classic')}
        >
          Classic
        </button>
        <button
          type="button"
          className="hsw-btn"
          aria-pressed={style === 'terminal'}
          onClick={() => switchTo('terminal')}
        >
          Terminal
        </button>
      </div>
    </>
  );
}
