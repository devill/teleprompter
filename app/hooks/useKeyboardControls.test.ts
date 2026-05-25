import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardControls } from './useKeyboardControls';

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('useKeyboardControls', () => {
  const handlers = {
    onPreviousSection: vi.fn(),
    onNextSection: vi.fn(),
    onPreviousParagraph: vi.fn(),
    onNextParagraph: vi.fn(),
  };

  beforeEach(() => {
    Object.values(handlers).forEach(fn => fn.mockReset());
  });

  afterEach(() => {
    // Clear any leftover listeners between tests
  });

  describe('default mapping', () => {
    it('ArrowUp / ArrowDown jump between sections', () => {
      renderHook(() => useKeyboardControls(handlers));

      dispatchKey('ArrowUp');
      expect(handlers.onPreviousSection).toHaveBeenCalledTimes(1);
      expect(handlers.onPreviousParagraph).not.toHaveBeenCalled();

      dispatchKey('ArrowDown');
      expect(handlers.onNextSection).toHaveBeenCalledTimes(1);
      expect(handlers.onNextParagraph).not.toHaveBeenCalled();
    });

    it('ArrowLeft / ArrowRight jump between paragraphs', () => {
      renderHook(() => useKeyboardControls(handlers));

      dispatchKey('ArrowLeft');
      expect(handlers.onPreviousParagraph).toHaveBeenCalledTimes(1);
      expect(handlers.onPreviousSection).not.toHaveBeenCalled();

      dispatchKey('ArrowRight');
      expect(handlers.onNextParagraph).toHaveBeenCalledTimes(1);
      expect(handlers.onNextSection).not.toHaveBeenCalled();
    });
  });

  describe('presenter mode swap', () => {
    it('ArrowUp / ArrowDown jump between paragraphs', () => {
      renderHook(() => useKeyboardControls({ ...handlers, presenterMode: true }));

      dispatchKey('ArrowUp');
      expect(handlers.onPreviousParagraph).toHaveBeenCalledTimes(1);
      expect(handlers.onPreviousSection).not.toHaveBeenCalled();

      dispatchKey('ArrowDown');
      expect(handlers.onNextParagraph).toHaveBeenCalledTimes(1);
      expect(handlers.onNextSection).not.toHaveBeenCalled();
    });

    it('ArrowLeft / ArrowRight jump between sections', () => {
      renderHook(() => useKeyboardControls({ ...handlers, presenterMode: true }));

      dispatchKey('ArrowLeft');
      expect(handlers.onPreviousSection).toHaveBeenCalledTimes(1);
      expect(handlers.onPreviousParagraph).not.toHaveBeenCalled();

      dispatchKey('ArrowRight');
      expect(handlers.onNextSection).toHaveBeenCalledTimes(1);
      expect(handlers.onNextParagraph).not.toHaveBeenCalled();
    });
  });
});
