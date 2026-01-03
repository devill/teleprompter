'use client';

import { useEffect } from 'react';

export interface KeyboardActions {
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onPageUp?: () => void;
  onPageDown?: () => void;
  onTogglePause?: () => void;
  onEscape?: () => void;
}

export function useKeyboardControls(actions: KeyboardActions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          actions.onScrollUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          actions.onScrollDown?.();
          break;
        case 'PageUp':
          e.preventDefault();
          actions.onPageUp?.();
          break;
        case 'PageDown':
          e.preventDefault();
          actions.onPageDown?.();
          break;
        case ' ':
          e.preventDefault();
          actions.onTogglePause?.();
          break;
        case 'Escape':
          actions.onEscape?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
