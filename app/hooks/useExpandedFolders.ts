import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'teleprompter_expanded_folders';

function loadFromStorage(): string[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(folders: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

export function useExpandedFolders(): {
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
} {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const saved = loadFromStorage();
    return new Set(saved ?? []);
  });

  useEffect(() => {
    saveToStorage([...expandedFolders]);
  }, [expandedFolders]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return { expandedFolders, toggleFolder };
}
