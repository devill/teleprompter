'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface SectionBounds {
  startWordIndex: number;
  endWordIndex: number;
}

export interface TeleprompterState {
  wordIndex: number;
  isRecordMode: boolean;
  isLoopMode: boolean;
  loopSectionBounds: SectionBounds | null;
}

const INITIAL_STATE: TeleprompterState = {
  wordIndex: 0,
  isRecordMode: false,
  isLoopMode: false,
  loopSectionBounds: null,
};

const STORAGE_KEY_PREFIX = 'teleprompter_session_';
const SAVE_DEBOUNCE_MS = 500;

interface PersistedSession {
  wordIndex: number;
  isRecordMode: boolean;
  isLoopMode: boolean;
  wasListening: boolean;
}

function getStorageKey(filePath: string | null): string | null {
  if (!filePath) return null;
  return `${STORAGE_KEY_PREFIX}${filePath}`;
}

function loadSavedSession(filePath: string | null): PersistedSession | null {
  if (typeof window === 'undefined') {
    console.log('[TeleprompterState] loadSavedSession: SSR, returning null');
    return null;
  }
  const key = getStorageKey(filePath);
  if (!key) {
    console.log('[TeleprompterState] loadSavedSession: no filePath, returning null');
    return null;
  }
  const saved = localStorage.getItem(key);
  if (!saved) {
    console.log(`[TeleprompterState] loadSavedSession: no saved value for key "${key}"`);
    return null;
  }
  try {
    const parsed = JSON.parse(saved) as PersistedSession;
    console.log(`[TeleprompterState] loadSavedSession: loaded from key "${key}":`, parsed);
    return parsed;
  } catch {
    console.log(`[TeleprompterState] loadSavedSession: failed to parse saved value`);
    return null;
  }
}

export interface UseTeleprompterStateReturn {
  state: TeleprompterState;
  savedSession: PersistedSession | null;
  setWordIndex: (index: number) => void;
  setIsRecordMode: (value: boolean) => void;
  setIsLoopMode: (value: boolean) => void;
  setLoopSectionBounds: (bounds: SectionBounds | null) => void;
  reset: () => void;
}

export function useTeleprompterState(
  filePath: string | null,
  wordsCount: number,
  isListening: boolean = false
): UseTeleprompterStateReturn {
  // Load saved session once on mount
  const [savedSession] = useState<PersistedSession | null>(() => loadSavedSession(filePath));

  const [state, setState] = useState<TeleprompterState>(() => {
    console.log(`[TeleprompterState] useState init: filePath="${filePath}", savedSession=`, savedSession);
    if (savedSession) {
      return {
        ...INITIAL_STATE,
        wordIndex: Math.max(0, savedSession.wordIndex),
        isRecordMode: savedSession.isRecordMode,
        isLoopMode: savedSession.isLoopMode,
        // loopSectionBounds will be recalculated by page.tsx
      };
    }
    return INITIAL_STATE;
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save session to localStorage (debounced)
  useEffect(() => {
    const key = getStorageKey(filePath);
    if (!key) {
      console.log(`[TeleprompterState] save effect: no key (filePath="${filePath}"), skipping save`);
      return;
    }

    const sessionToSave: PersistedSession = {
      wordIndex: state.wordIndex,
      isRecordMode: state.isRecordMode,
      isLoopMode: state.isLoopMode,
      wasListening: isListening,
    };

    console.log(`[TeleprompterState] save effect: scheduling save to key="${key}":`, sessionToSave);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      console.log(`[TeleprompterState] save effect: SAVING to key="${key}":`, sessionToSave);
      localStorage.setItem(key, JSON.stringify(sessionToSave));
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [filePath, state.wordIndex, state.isRecordMode, state.isLoopMode, isListening]);

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
      // Clear loop bounds when loop mode is disabled
      if (!value) {
        return { ...prev, isLoopMode: value, loopSectionBounds: null };
      }
      return { ...prev, isLoopMode: value };
    });
  }, []);

  const setLoopSectionBounds = useCallback((bounds: SectionBounds | null) => {
    setState(prev => {
      if (prev.loopSectionBounds === bounds) return prev;
      if (bounds && prev.loopSectionBounds &&
          bounds.startWordIndex === prev.loopSectionBounds.startWordIndex &&
          bounds.endWordIndex === prev.loopSectionBounds.endWordIndex) {
        return prev;
      }
      return { ...prev, loopSectionBounds: bounds };
    });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    savedSession,
    setWordIndex,
    setIsRecordMode,
    setIsLoopMode,
    setLoopSectionBounds,
    reset,
  };
}
