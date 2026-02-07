'use client';

import { useState, useEffect, useCallback } from 'react';

const STATIC_STORAGE_KEY = 'teleprompter_static_content';
const isStaticMode = process.env.NEXT_PUBLIC_STATIC_MODE === 'true';

export function useContentSource(filePath: string | null) {
  // In static mode, we load synchronously from localStorage after mount
  // so start with isLoading: false to show the paste prompt immediately
  const [content, setContentState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isStaticMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isStaticMode) {
      // Static mode: load from localStorage (only on client)
      const saved = localStorage.getItem(STATIC_STORAGE_KEY);
      setContentState(saved);
    } else if (filePath) {
      // Local mode: fetch from API
      setIsLoading(true);
      setError(null);
      fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load file');
          return res.text();
        })
        .then(text => {
          setContentState(text);
          setIsLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [filePath]);

  const setContent = useCallback((text: string) => {
    setContentState(text);
    if (isStaticMode) {
      localStorage.setItem(STATIC_STORAGE_KEY, text);
    }
  }, []);

  return { content, isLoading, error, setContent, isStaticMode };
}
