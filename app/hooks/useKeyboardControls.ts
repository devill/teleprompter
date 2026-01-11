'use client';

import { useEffect } from 'react';

export interface KeyboardActions {
  onPreviousSection?: () => void;
  onNextSection?: () => void;
  onPreviousParagraph?: () => void;
  onNextParagraph?: () => void;
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
          actions.onPreviousSection?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          actions.onNextSection?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          actions.onPreviousParagraph?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          actions.onNextParagraph?.();
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
