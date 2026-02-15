'use client';

import { useState, useEffect, useCallback } from 'react';
import { sourceRegistry, isFileSystemAccessSupported } from '@/app/lib/storage';
import type { StorageSource } from '@/app/lib/storage';

export function useStorageRegistry() {
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSources = useCallback(() => {
    setSources(sourceRegistry.getSources());
  }, []);

  useEffect(() => {
    sourceRegistry.initialize().then(() => {
      refreshSources();
      setIsLoading(false);
    });
  }, [refreshSources]);

  const addFolder = useCallback(async () => {
    await sourceRegistry.addFolder();
    refreshSources();
  }, [refreshSources]);

  const removeFolder = useCallback(async (id: string) => {
    await sourceRegistry.removeFolder(id);
    refreshSources();
  }, [refreshSources]);

  return {
    sources,
    isLoading,
    addFolder,
    removeFolder,
    isFileSystemSupported: isFileSystemAccessSupported(),
  };
}
