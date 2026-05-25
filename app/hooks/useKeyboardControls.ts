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
  onPaste?: () => void;
  // When true, swap vertical (up/down) and horizontal (left/right) arrow roles
  // so presenter clickers — which usually emit up/down — can drive paragraph navigation.
  presenterMode?: boolean;
}

export function useKeyboardControls(actions: KeyboardActions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const verticalPrev = actions.presenterMode ? actions.onPreviousParagraph : actions.onPreviousSection;
      const verticalNext = actions.presenterMode ? actions.onNextParagraph : actions.onNextSection;
      const horizontalPrev = actions.presenterMode ? actions.onPreviousSection : actions.onPreviousParagraph;
      const horizontalNext = actions.presenterMode ? actions.onNextSection : actions.onNextParagraph;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          verticalPrev?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          verticalNext?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          horizontalPrev?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          horizontalNext?.();
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
        case 'v':
          if ((e.metaKey || e.ctrlKey) && actions.onPaste) {
            e.preventDefault();
            actions.onPaste();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
