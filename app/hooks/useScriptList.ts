'use client';

import { useState, useEffect, useCallback } from 'react';
import { sourceRegistry, ScriptFile } from '@/app/lib/storage';

interface LoadedFiles {
  sourceId: string;
  refreshCount: number;
  files: ScriptFile[];
}

export function useScriptList(sourceId: string) {
  const [loaded, setLoaded] = useState<LoadedFiles>({
    sourceId,
    refreshCount: -1,
    files: [],
  });
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let files: ScriptFile[] = [];
      try {
        const source = sourceRegistry.getSource(sourceId);
        if (source) {
          files = await source.listFiles();
        }
      } catch {
        files = [];
      }
      if (!cancelled) setLoaded({ sourceId, refreshCount, files });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sourceId, refreshCount]);

  const refresh = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  return {
    files: loaded.sourceId === sourceId ? loaded.files : [],
    isLoading: loaded.sourceId !== sourceId || loaded.refreshCount !== refreshCount,
    refresh,
  };
}
