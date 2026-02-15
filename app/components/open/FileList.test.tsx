import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileList from './FileList';
import { ScriptFile } from '@/app/lib/storage';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockFiles: ScriptFile[] = [
  { id: 'file-1', name: 'Test Script', sourceId: 'my-scripts' },
  { id: 'file-2', name: 'Another Script', sourceId: 'my-scripts' },
];

describe('FileList rename functionality', () => {
  describe('rename button visibility', () => {
    it('does not render rename button when onRename is not provided', () => {
      render(
        <FileList
          files={mockFiles}
          isLoading={false}
          showDelete={true}
        />
      );

      expect(screen.queryByTitle('Rename script')).toBeNull();
    });

    it('renders rename button when showDelete and onRename are both provided', () => {
      const onRename = vi.fn();

      render(
        <FileList
          files={mockFiles}
          isLoading={false}
          showDelete={true}
          onRename={onRename}
        />
      );

      const renameButtons = screen.getAllByTitle('Rename script');
      expect(renameButtons).toHaveLength(2);
    });

    it('does not render rename button when showDelete is false', () => {
      const onRename = vi.fn();

      render(
        <FileList
          files={mockFiles}
          isLoading={false}
          showDelete={false}
          onRename={onRename}
        />
      );

      expect(screen.queryByTitle('Rename script')).toBeNull();
    });
  });

  describe('edit mode', () => {
    it('enters edit mode when rename button is clicked', () => {
      const onRename = vi.fn();

      render(
        <FileList
          files={mockFiles}
          isLoading={false}
          showDelete={true}
          onRename={onRename}
        />
      );

      const renameButtons = screen.getAllByTitle('Rename script');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByDisplayValue('Test Script');
      expect(input).toBeTruthy();
      expect(input.tagName).toBe('INPUT');
    });

    it('saves new name when Enter key is pressed', () => {
      const onRename = vi.fn();

      render(
        <FileList
          files={mockFiles}
          isLoading={false}
          showDelete={true}
          onRename={onRename}
        />
      );

      const renameButtons = screen.getAllByTitle('Rename script');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByDisplayValue('Test Script');
      fireEvent.change(input, { target: { value: 'New Script Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onRename).toHaveBeenCalledWith('file-1', 'New Script Name');
    });

    it('cancels edit when Escape key is pressed', () => {
      const onRename = vi.fn();

      render(
        <FileList
          files={mockFiles}
          isLoading={false}
          showDelete={true}
          onRename={onRename}
        />
      );

      const renameButtons = screen.getAllByTitle('Rename script');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByDisplayValue('Test Script');
      fireEvent.change(input, { target: { value: 'New Script Name' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onRename).not.toHaveBeenCalled();
      expect(screen.queryByDisplayValue('New Script Name')).toBeNull();
    });
  });
});
