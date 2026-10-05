'use client';

import { useState, useEffect } from 'react';
import { FileSystemSource } from '@/app/lib/storage/fileSystemSource';
import type { FileSystemContents } from '@/app/lib/storage/types';

interface UseFileSystemContentsResult {
  contents: FileSystemContents | null;
  isLoading: boolean;
  error: Error | null;
}

interface LoadedContents {
  source: FileSystemSource | null;
  contents: FileSystemContents | null;
  error: Error | null;
}

export function useFileSystemContents(
  source: FileSystemSource | null
): UseFileSystemContentsResult {
  const [loaded, setLoaded] = useState<LoadedContents>({
    source: null,
    contents: null,
    error: null,
  });

  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    source
      .listContents()
      .then((contents) => {
        if (!cancelled) setLoaded({ source, contents, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            source,
            contents: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  const isLoadedForSource = loaded.source !== null && loaded.source === source;
  return {
    contents: isLoadedForSource ? loaded.contents : null,
    isLoading: source !== null && !isLoadedForSource,
    error: isLoadedForSource ? loaded.error : null,
  };
}
