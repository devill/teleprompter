import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTeleprompterState } from './useTeleprompterState';

describe('useTeleprompterState', () => {
  describe('initial state', () => {
    it('starts with wordIndex at 0', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));
      expect(result.current.state.wordIndex).toBe(0);
    });

    it('starts with isLoopMode false', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));
      expect(result.current.state.isLoopMode).toBe(false);
    });

    it('starts with loopSectionBounds null', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));
      expect(result.current.state.loopSectionBounds).toBe(null);
    });
  });

  describe('setWordIndex', () => {
    it('updates wordIndex', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setWordIndex(50);
      });

      expect(result.current.state.wordIndex).toBe(50);
    });

    it('clamps wordIndex to max valid index', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setWordIndex(150);
      });

      expect(result.current.state.wordIndex).toBe(99);
    });

    it('clamps negative wordIndex to 0', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setWordIndex(-10);
      });

      expect(result.current.state.wordIndex).toBe(0);
    });

    it('handles wordsCount of 0', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 0, false));

      act(() => {
        result.current.setWordIndex(10);
      });

      expect(result.current.state.wordIndex).toBe(0);
    });
  });

  describe('setIsLoopMode', () => {
    it('updates isLoopMode to true', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setIsLoopMode(true);
      });

      expect(result.current.state.isLoopMode).toBe(true);
    });

    it('updates isLoopMode to false', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setIsLoopMode(true);
      });
      act(() => {
        result.current.setIsLoopMode(false);
      });

      expect(result.current.state.isLoopMode).toBe(false);
    });

    it('clears loopSectionBounds when setting isLoopMode to false', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setIsLoopMode(true);
        result.current.setLoopSectionBounds({ startWordIndex: 10, endWordIndex: 50 });
      });
      expect(result.current.state.loopSectionBounds).toEqual({ startWordIndex: 10, endWordIndex: 50 });

      act(() => {
        result.current.setIsLoopMode(false);
      });

      expect(result.current.state.loopSectionBounds).toBe(null);
    });
  });

  describe('setLoopSectionBounds', () => {
    it('updates loopSectionBounds', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setLoopSectionBounds({ startWordIndex: 10, endWordIndex: 50 });
      });

      expect(result.current.state.loopSectionBounds).toEqual({ startWordIndex: 10, endWordIndex: 50 });
    });

    it('can set loopSectionBounds to null', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setLoopSectionBounds({ startWordIndex: 10, endWordIndex: 50 });
      });
      act(() => {
        result.current.setLoopSectionBounds(null);
      });

      expect(result.current.state.loopSectionBounds).toBe(null);
    });

    it('returns same state when setting equivalent bounds', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setLoopSectionBounds({ startWordIndex: 10, endWordIndex: 50 });
      });
      const stateAfterFirstSet = result.current.state;

      act(() => {
        result.current.setLoopSectionBounds({ startWordIndex: 10, endWordIndex: 50 });
      });

      expect(result.current.state).toBe(stateAfterFirstSet);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));

      act(() => {
        result.current.setWordIndex(50);
        result.current.setIsLoopMode(true);
        result.current.setLoopSectionBounds({ startWordIndex: 10, endWordIndex: 50 });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.wordIndex).toBe(0);
      expect(result.current.state.isLoopMode).toBe(false);
      expect(result.current.state.loopSectionBounds).toBe(null);
    });
  });

  describe('wordsCount changes', () => {
    it('clamps wordIndex when wordsCount decreases', () => {
      const { result, rerender } = renderHook(
        ({ wordsCount }) => useTeleprompterState(null, wordsCount, false),
        { initialProps: { wordsCount: 100 } }
      );

      act(() => {
        result.current.setWordIndex(80);
      });
      expect(result.current.state.wordIndex).toBe(80);

      rerender({ wordsCount: 50 });

      expect(result.current.state.wordIndex).toBe(49);
    });

    it('preserves wordIndex when wordsCount increases', () => {
      const { result, rerender } = renderHook(
        ({ wordsCount }) => useTeleprompterState(null, wordsCount, false),
        { initialProps: { wordsCount: 50 } }
      );

      act(() => {
        result.current.setWordIndex(30);
      });

      rerender({ wordsCount: 100 });

      expect(result.current.state.wordIndex).toBe(30);
    });

    it('preserves wordIndex when it is still valid', () => {
      const { result, rerender } = renderHook(
        ({ wordsCount }) => useTeleprompterState(null, wordsCount, false),
        { initialProps: { wordsCount: 100 } }
      );

      act(() => {
        result.current.setWordIndex(30);
      });

      rerender({ wordsCount: 50 });

      expect(result.current.state.wordIndex).toBe(30);
    });
  });

  describe('state object identity', () => {
    it('returns same state object when nothing changes', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));
      const firstState = result.current.state;

      act(() => {
        result.current.setWordIndex(0);
      });

      expect(result.current.state).toBe(firstState);
    });

    it('returns same state when setting same isLoopMode value', () => {
      const { result } = renderHook(() => useTeleprompterState(null, 100, false));
      const firstState = result.current.state;

      act(() => {
        result.current.setIsLoopMode(false);
      });

      expect(result.current.state).toBe(firstState);
    });
  });
});
