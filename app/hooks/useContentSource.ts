'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { sourceRegistry, StorageSource } from '@/app/lib/storage';

interface ContentSourceResult {
  content: string | null;
  isLoading: boolean;
  error: string | null;
  setContent: (text: string) => void;
  canEdit: boolean;
}

interface LoadedData {
  content: string;
  source: StorageSource;
}

export function useContentSource(scriptId: string | null): ContentSourceResult {
  // Track which scriptId we've successfully loaded
  const [loadedScriptId, setLoadedScriptId] = useState<string | null>(null);
  const [loadedData, setLoadedData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track current scriptId to detect stale responses
  const currentScriptIdRef = useRef(scriptId);

  useEffect(() => {
    currentScriptIdRef.current = scriptId;
  });

  useEffect(() => {
    if (!scriptId) {
      return;
    }

    sourceRegistry
      .getFile(scriptId)
      .then(({ source: loadedSource, content: loadedContent }) => {
        // Only update if this is still the current scriptId
        if (currentScriptIdRef.current !== scriptId) return;
        setLoadedData({ content: loadedContent, source: loadedSource });
        setLoadedScriptId(scriptId);
        setError(null);
      })
      .catch((err: Error) => {
        if (currentScriptIdRef.current !== scriptId) return;
        setError(err.message);
        setLoadedData(null);
        setLoadedScriptId(scriptId);
      });
  }, [scriptId]);

  const setContent = useCallback(
    (text: string) => {
      if (!loadedData) return;
      setLoadedData(prev => prev ? { ...prev, content: text } : null);
      if (scriptId && !loadedData.source.readonly) {
        loadedData.source.writeFile(scriptId, text).catch((err: Error) => {
          setError(err.message);
        });
      }
    },
    [loadedData, scriptId]
  );

  // Derive states
  const isLoading = useMemo(() => {
    if (scriptId === null) return false;
    // Loading if we have a scriptId but haven't loaded it yet
    return loadedScriptId !== scriptId;
  }, [scriptId, loadedScriptId]);

  const content = useMemo(() => {
    if (scriptId === null) return null;
    if (loadedScriptId !== scriptId) return null;
    return loadedData?.content ?? null;
  }, [scriptId, loadedScriptId, loadedData]);

  const canEdit = loadedData !== null && !loadedData.source.readonly;

  return {
    content,
    isLoading,
    error: loadedScriptId === scriptId ? error : null,
    setContent,
    canEdit,
  };
}
