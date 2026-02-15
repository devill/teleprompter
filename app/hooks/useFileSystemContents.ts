'use client';

import { useState, useEffect } from 'react';
import { FileSystemSource } from '@/app/lib/storage/fileSystemSource';
import type { FileSystemContents } from '@/app/lib/storage/types';

interface UseFileSystemContentsResult {
  contents: FileSystemContents | null;
  isLoading: boolean;
  error: Error | null;
}

export function useFileSystemContents(
  source: FileSystemSource | null
): UseFileSystemContentsResult {
  const [contents, setContents] = useState<FileSystemContents | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!source) {
      setContents(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    source
      .listContents()
      .then((loadedContents) => {
        setContents(loadedContents);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setContents(null);
        setIsLoading(false);
      });
  }, [source]);

  return { contents, isLoading, error };
}
