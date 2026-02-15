'use client';

import { useState, useEffect, useCallback } from 'react';
import { sourceRegistry, ScriptFile } from '@/app/lib/storage';

export function useScriptList(sourceId: string) {
  const [files, setFiles] = useState<ScriptFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const source = sourceRegistry.getSource(sourceId);
      if (source) {
        const loadedFiles = await source.listFiles();
        setFiles(loadedFiles);
      } else {
        setFiles([]);
      }
    } catch {
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const refresh = useCallback(() => {
    loadFiles();
  }, [loadFiles]);

  return { files, isLoading, refresh };
}
