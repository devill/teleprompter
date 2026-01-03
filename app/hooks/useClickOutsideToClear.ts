'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseClickOutsideToClearOptions {
  onClear: () => void;
  isActive: boolean;
}

export function useClickOutsideToClear({
  onClear,
  isActive,
}: UseClickOutsideToClearOptions) {
  const justSelectedRef = useRef(false);

  const markSelectionMade = useCallback(() => {
    justSelectedRef.current = true;
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const handleMouseDown = (e: MouseEvent) => {
      justSelectedRef.current = false;

      const target = e.target as HTMLElement;
      if (target.closest('[data-comment-interactive]')) return;

      requestAnimationFrame(() => {
        if (!justSelectedRef.current) {
          onClear();
        }
      });
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isActive, onClear]);

  return { markSelectionMade };
}
