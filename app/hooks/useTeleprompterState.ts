'use client';

import { useState, useCallback, useEffect } from 'react';

export interface TeleprompterState {
  wordIndex: number;
  isRecordMode: boolean;
  isLoopMode: boolean;
}

const INITIAL_STATE: TeleprompterState = {
  wordIndex: 0,
  isRecordMode: false,
  isLoopMode: false,
};

export interface UseTeleprompterStateReturn {
  state: TeleprompterState;
  setWordIndex: (index: number) => void;
  setIsRecordMode: (value: boolean) => void;
  setIsLoopMode: (value: boolean) => void;
  reset: () => void;
}

export function useTeleprompterState(
  wordsCount: number
): UseTeleprompterStateReturn {
  const [state, setState] = useState<TeleprompterState>(INITIAL_STATE);

  // Clamp wordIndex when wordsCount changes (e.g., content loaded/changed)
  useEffect(() => {
    if (wordsCount === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Clamping is intentional when external wordsCount changes
    setState(prev => {
      const maxIndex = Math.max(0, wordsCount - 1);
      if (prev.wordIndex > maxIndex) {
        return { ...prev, wordIndex: maxIndex };
      }
      return prev;
    });
  }, [wordsCount]);

  const setWordIndex = useCallback((index: number) => {
    setState(prev => {
      const clampedIndex = Math.max(0, Math.min(index, Math.max(0, wordsCount - 1)));
      if (prev.wordIndex === clampedIndex) return prev;
      return { ...prev, wordIndex: clampedIndex };
    });
  }, [wordsCount]);

  const setIsRecordMode = useCallback((value: boolean) => {
    setState(prev => {
      if (prev.isRecordMode === value) return prev;
      return { ...prev, isRecordMode: value };
    });
  }, []);

  const setIsLoopMode = useCallback((value: boolean) => {
    setState(prev => {
      if (prev.isLoopMode === value) return prev;
      return { ...prev, isLoopMode: value };
    });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    setWordIndex,
    setIsRecordMode,
    setIsLoopMode,
    reset,
  };
}
