import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePasteHandler } from './usePasteHandler';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateFile = vi.fn();
vi.mock('@/app/lib/storage', () => ({
  myScriptsSource: {
    createFile: (...args: unknown[]) => mockCreateFile(...args),
  },
}));

function createKeyboardEvent(key: string, modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    bubbles: true,
  });
}

function mockClipboardWithText(text: string) {
  Object.assign(navigator, {
    clipboard: {
      read: vi.fn().mockResolvedValue([
        {
          types: ['text/plain'],
          getType: vi.fn().mockResolvedValue(new Blob([text], { type: 'text/plain' })),
        },
      ]),
      readText: vi.fn().mockResolvedValue(text),
    },
  });
}

describe('usePasteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFile.mockResolvedValue({ id: 'my-scripts:test-uuid', name: 'Untitled Script' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('keyboard event handling', () => {
    it('triggers paste logic on Cmd+V', async () => {
      mockClipboardWithText('Hello World');
      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).toHaveBeenCalledWith('Hello World', 'Hello World');
      expect(mockPush).toHaveBeenCalledWith('/teleprompter?id=my-scripts%3Atest-uuid');
    });

    it('triggers paste logic on Ctrl+V', async () => {
      mockClipboardWithText('Hello World');
      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { ctrlKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).toHaveBeenCalledWith('Hello World', 'Hello World');
    });

    it('does not trigger on V without modifier key', async () => {
      mockClipboardWithText('Hello World');
      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v'));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).not.toHaveBeenCalled();
    });
  });

  describe('editable element handling', () => {
    it('ignores paste when target is INPUT element', async () => {
      mockClipboardWithText('Hello World');
      renderHook(() => usePasteHandler([]));

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = createKeyboardEvent('v', { metaKey: true });
      Object.defineProperty(event, 'target', { value: input });

      await act(async () => {
        window.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('ignores paste when target is TEXTAREA element', async () => {
      mockClipboardWithText('Hello World');
      renderHook(() => usePasteHandler([]));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = createKeyboardEvent('v', { metaKey: true });
      Object.defineProperty(event, 'target', { value: textarea });

      await act(async () => {
        window.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it('ignores paste when target has contentEditable', async () => {
      mockClipboardWithText('Hello World');
      renderHook(() => usePasteHandler([]));

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      const event = createKeyboardEvent('v', { metaKey: true });
      Object.defineProperty(event, 'target', { value: div });

      await act(async () => {
        window.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).not.toHaveBeenCalled();
      document.body.removeChild(div);
    });
  });

  describe('empty content handling', () => {
    it('does not create script when clipboard is empty', async () => {
      mockClipboardWithText('');
      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not create script when clipboard contains only whitespace', async () => {
      mockClipboardWithText('   \n\t  ');
      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('navigates to teleprompter after successful script creation', async () => {
      mockClipboardWithText('Test content');
      mockCreateFile.mockResolvedValue({ id: 'my-scripts:abc123', name: 'Test content' });
      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).toHaveBeenCalledWith('Test content', 'Test content');
      expect(mockPush).toHaveBeenCalledWith('/teleprompter?id=my-scripts%3Aabc123');
    });
  });

  describe('title extraction and unique name generation', () => {
    it('uses first line of content as script name', async () => {
      mockClipboardWithText('My Great Speech\n\nHello everyone...');
      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).toHaveBeenCalledWith('My Great Speech', 'My Great Speech\n\nHello everyone...');
    });

    it('adds number suffix when title conflicts with existing scripts', async () => {
      mockClipboardWithText('My Speech\n\nContent here');
      renderHook(() => usePasteHandler(['My Speech', 'My Speech 2']));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).toHaveBeenCalledWith('My Speech 3', 'My Speech\n\nContent here');
    });
  });

  describe('HTML clipboard content', () => {
    it('prefers HTML content and converts to markdown', async () => {
      const html = '<h1>My Title</h1><p>Hello World</p>';
      // Create a mock blob with a text() method that returns our HTML
      const mockBlob = {
        text: vi.fn().mockResolvedValue(html),
        type: 'text/html',
      };
      const getTypeMock = vi.fn().mockResolvedValue(mockBlob);
      const readMock = vi.fn().mockResolvedValue([{
        types: ['text/html'],
        getType: getTypeMock,
      }]);

      Object.assign(navigator, {
        clipboard: {
          read: readMock,
          readText: vi.fn().mockResolvedValue(''),
        },
      });

      renderHook(() => usePasteHandler([]));

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        // Allow multiple microtask cycles for all promises to resolve
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(readMock).toHaveBeenCalled();
      expect(getTypeMock).toHaveBeenCalled();
      expect(mockBlob.text).toHaveBeenCalled();
      expect(mockCreateFile).toHaveBeenCalled();
      const [name, content] = mockCreateFile.mock.calls[0];
      expect(name).toBe('My Title'); // Title extracted from h1 (markdown # stripped)
      expect(content).toContain('# My Title');
      expect(content).toContain('Hello World');
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', async () => {
      mockClipboardWithText('Hello World');
      const { unmount } = renderHook(() => usePasteHandler([]));

      unmount();

      await act(async () => {
        window.dispatchEvent(createKeyboardEvent('v', { metaKey: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockCreateFile).not.toHaveBeenCalled();
    });
  });
});
