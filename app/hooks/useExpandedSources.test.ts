import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpandedSources } from './useExpandedSources';

const STORAGE_KEY = 'teleprompter_expanded_sources';

function saveState(expanded: string[], known: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ expanded, known }));
}

function getStoredState(): { expanded: string[]; known: string[] } {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { expanded: [], known: [] };
  return JSON.parse(saved);
}

describe('useExpandedSources', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('initializes with my-scripts expanded when no saved state', () => {
      const { result } = renderHook(() => useExpandedSources(['my-scripts', 'fs:1']));

      expect(result.current.expandedSources.has('my-scripts')).toBe(true);
      expect(result.current.expandedSources.has('fs:1')).toBe(false);
    });

    it('restores saved state from localStorage', () => {
      // fs:2 is known but collapsed
      saveState(['my-scripts', 'fs:1'], ['my-scripts', 'fs:1', 'fs:2']);

      const { result } = renderHook(() => useExpandedSources(['my-scripts', 'fs:1', 'fs:2']));

      expect(result.current.expandedSources.has('my-scripts')).toBe(true);
      expect(result.current.expandedSources.has('fs:1')).toBe(true);
      expect(result.current.expandedSources.has('fs:2')).toBe(false);
    });

    it('handles legacy format (plain array)', () => {
      // Legacy format: just an array of expanded IDs
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['my-scripts', 'fs:1']));

      const { result } = renderHook(() => useExpandedSources(['my-scripts', 'fs:1']));

      expect(result.current.expandedSources.has('my-scripts')).toBe(true);
      expect(result.current.expandedSources.has('fs:1')).toBe(true);
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');

      const { result } = renderHook(() => useExpandedSources(['my-scripts']));

      expect(result.current.expandedSources.has('my-scripts')).toBe(true);
    });
  });

  describe('toggleSource', () => {
    it('expands a collapsed source', () => {
      const { result } = renderHook(() => useExpandedSources(['my-scripts', 'fs:1']));

      act(() => {
        result.current.toggleSource('fs:1');
      });

      expect(result.current.expandedSources.has('fs:1')).toBe(true);
    });

    it('collapses an expanded source', () => {
      const { result } = renderHook(() => useExpandedSources(['my-scripts', 'fs:1']));

      expect(result.current.expandedSources.has('my-scripts')).toBe(true);

      act(() => {
        result.current.toggleSource('my-scripts');
      });

      expect(result.current.expandedSources.has('my-scripts')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('persists state changes to localStorage', () => {
      const { result } = renderHook(() => useExpandedSources(['my-scripts', 'fs:1']));

      act(() => {
        result.current.toggleSource('fs:1');
      });

      const { expanded } = getStoredState();
      expect(expanded).toContain('my-scripts');
      expect(expanded).toContain('fs:1');
    });

    it('persists collapsed state to localStorage', () => {
      const { result } = renderHook(() => useExpandedSources(['my-scripts', 'fs:1']));

      act(() => {
        result.current.toggleSource('my-scripts');
      });

      const { expanded } = getStoredState();
      expect(expanded).not.toContain('my-scripts');
    });

    it('persists known sources to localStorage', () => {
      renderHook(() => useExpandedSources(['my-scripts', 'fs:1']));

      const { known } = getStoredState();
      expect(known).toContain('my-scripts');
      expect(known).toContain('fs:1');
    });
  });

  describe('new source detection', () => {
    it('auto-expands newly-added sources', () => {
      const { result, rerender } = renderHook(
        ({ sourceIds }) => useExpandedSources(sourceIds),
        { initialProps: { sourceIds: ['my-scripts'] } }
      );

      expect(result.current.expandedSources.has('fs:new')).toBe(false);

      rerender({ sourceIds: ['my-scripts', 'fs:new'] });

      expect(result.current.expandedSources.has('fs:new')).toBe(true);
    });

    it('does not auto-expand sources that were previously known', () => {
      // fs:1 was known and collapsed before
      saveState(['my-scripts'], ['my-scripts', 'fs:1']);

      const { result, rerender } = renderHook(
        ({ sourceIds }) => useExpandedSources(sourceIds),
        { initialProps: { sourceIds: ['my-scripts'] } }
      );

      // fs:1 arrives (e.g., async load)
      rerender({ sourceIds: ['my-scripts', 'fs:1'] });

      // Should stay collapsed because it was previously known
      expect(result.current.expandedSources.has('fs:1')).toBe(false);
    });

    it('does not collapse existing sources when new ones are added', () => {
      saveState(['my-scripts', 'fs:1'], ['my-scripts', 'fs:1']);

      const { result, rerender } = renderHook(
        ({ sourceIds }) => useExpandedSources(sourceIds),
        { initialProps: { sourceIds: ['my-scripts', 'fs:1'] } }
      );

      expect(result.current.expandedSources.has('fs:1')).toBe(true);

      rerender({ sourceIds: ['my-scripts', 'fs:1', 'fs:new'] });

      expect(result.current.expandedSources.has('fs:1')).toBe(true);
      expect(result.current.expandedSources.has('fs:new')).toBe(true);
    });

    it('persists auto-expanded sources to localStorage', () => {
      const { rerender } = renderHook(
        ({ sourceIds }) => useExpandedSources(sourceIds),
        { initialProps: { sourceIds: ['my-scripts'] } }
      );

      rerender({ sourceIds: ['my-scripts', 'fs:new'] });

      const { expanded, known } = getStoredState();
      expect(expanded).toContain('fs:new');
      expect(known).toContain('fs:new');
    });
  });

  describe('removed sources', () => {
    it('removes sources from expanded set when they are removed from sourceIds', () => {
      saveState(['my-scripts', 'fs:1'], ['my-scripts', 'fs:1']);

      const { result, rerender } = renderHook(
        ({ sourceIds }) => useExpandedSources(sourceIds),
        { initialProps: { sourceIds: ['my-scripts', 'fs:1'] } }
      );

      expect(result.current.expandedSources.has('fs:1')).toBe(true);

      rerender({ sourceIds: ['my-scripts'] });

      expect(result.current.expandedSources.has('fs:1')).toBe(false);
    });
  });
});
