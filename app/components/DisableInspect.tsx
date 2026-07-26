'use client';

import { useEffect } from 'react';

// Deterrent only — DevTools, view-source, and the browser menu can still
// reach everything a page ships. This just blocks the casual right-click
// and keyboard shortcuts.
export default function DisableInspect() {
  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const blockShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'f12') {
        event.preventDefault();
        return;
      }

      const combo = event.ctrlKey || event.metaKey;
      if (!combo) return;

      // Ctrl/Cmd+Shift+I/J/C (DevTools panels), Ctrl/Cmd+U (view-source)
      if (event.shiftKey && ['i', 'j', 'c'].includes(key)) {
        event.preventDefault();
        return;
      }
      if (key === 'u') {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockShortcuts);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockShortcuts);
    };
  }, []);

  return null;
}
