import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpandedFolders } from './useExpandedFolders';

const STORAGE_KEY = 'teleprompter_expanded_folders';

function getStoredFolders(): string[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  return JSON.parse(saved);
}

describe('useExpandedFolders', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('toggleFolder', () => {
    it('adds folder to set when toggling unexpanded folder', () => {
      const { result } = renderHook(() => useExpandedFolders());

      expect(result.current.expandedFolders.has('/path/to/folder')).toBe(false);

      act(() => {
        result.current.toggleFolder('/path/to/folder');
      });

      expect(result.current.expandedFolders.has('/path/to/folder')).toBe(true);
    });

    it('removes folder from set when toggling expanded folder', () => {
      const { result } = renderHook(() => useExpandedFolders());

      act(() => {
        result.current.toggleFolder('/path/to/folder');
      });

      expect(result.current.expandedFolders.has('/path/to/folder')).toBe(true);

      act(() => {
        result.current.toggleFolder('/path/to/folder');
      });

      expect(result.current.expandedFolders.has('/path/to/folder')).toBe(false);
    });

    it('handles multiple folders independently', () => {
      const { result } = renderHook(() => useExpandedFolders());

      act(() => {
        result.current.toggleFolder('/folder1');
        result.current.toggleFolder('/folder2');
      });

      expect(result.current.expandedFolders.has('/folder1')).toBe(true);
      expect(result.current.expandedFolders.has('/folder2')).toBe(true);

      act(() => {
        result.current.toggleFolder('/folder1');
      });

      expect(result.current.expandedFolders.has('/folder1')).toBe(false);
      expect(result.current.expandedFolders.has('/folder2')).toBe(true);
    });
  });

  describe('persistence', () => {
    it('persists expanded folders to localStorage', () => {
      const { result } = renderHook(() => useExpandedFolders());

      act(() => {
        result.current.toggleFolder('/path/to/folder');
      });

      const stored = getStoredFolders();
      expect(stored).toContain('/path/to/folder');
    });

    it('removes collapsed folders from localStorage', () => {
      const { result } = renderHook(() => useExpandedFolders());

      act(() => {
        result.current.toggleFolder('/path/to/folder');
      });

      expect(getStoredFolders()).toContain('/path/to/folder');

      act(() => {
        result.current.toggleFolder('/path/to/folder');
      });

      expect(getStoredFolders()).not.toContain('/path/to/folder');
    });

    it('persists multiple folders to localStorage', () => {
      const { result } = renderHook(() => useExpandedFolders());

      act(() => {
        result.current.toggleFolder('/folder1');
        result.current.toggleFolder('/folder2');
      });

      const stored = getStoredFolders();
      expect(stored).toContain('/folder1');
      expect(stored).toContain('/folder2');
    });
  });

  describe('initial state', () => {
    it('loads expanded folders from localStorage on mount', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['/saved/folder1', '/saved/folder2']));

      const { result } = renderHook(() => useExpandedFolders());

      expect(result.current.expandedFolders.has('/saved/folder1')).toBe(true);
      expect(result.current.expandedFolders.has('/saved/folder2')).toBe(true);
    });

    it('starts with empty set when no saved state', () => {
      const { result } = renderHook(() => useExpandedFolders());

      expect(result.current.expandedFolders.size).toBe(0);
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');

      const { result } = renderHook(() => useExpandedFolders());

      expect(result.current.expandedFolders.size).toBe(0);
    });

    it('handles non-array JSON in localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));

      const { result } = renderHook(() => useExpandedFolders());

      expect(result.current.expandedFolders.size).toBe(0);
    });
  });
});
