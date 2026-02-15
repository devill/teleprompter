import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FolderTree from './FolderTree';
import { ScriptFile, FolderEntry } from '@/app/lib/storage';

const mockFiles: ScriptFile[] = [
  { id: 'fs:test:file1.md', name: 'file1.md', sourceId: 'test' },
  { id: 'fs:test:file2.md', name: 'file2.md', sourceId: 'test' },
];

const mockFolders: FolderEntry[] = [
  {
    name: 'docs',
    path: 'docs',
    files: [
      { id: 'fs:test:docs/nested.md', name: 'nested.md', sourceId: 'test' },
    ],
    subfolders: [
      {
        name: 'drafts',
        path: 'docs/drafts',
        files: [
          { id: 'fs:test:docs/drafts/draft.md', name: 'draft.md', sourceId: 'test' },
        ],
        subfolders: [],
      },
    ],
  },
];

describe('FolderTree', () => {
  describe('rendering files and folders', () => {
    it('renders files at current level', () => {
      render(
        <FolderTree
          files={mockFiles}
          folders={[]}
          expandedFolders={new Set()}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      expect(screen.getByText('file1')).toBeTruthy();
      expect(screen.getByText('file2')).toBeTruthy();
    });

    it('renders folder names', () => {
      render(
        <FolderTree
          files={[]}
          folders={mockFolders}
          expandedFolders={new Set()}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      expect(screen.getByText('docs')).toBeTruthy();
    });

    it('strips .md extension from file names', () => {
      render(
        <FolderTree
          files={mockFiles}
          folders={[]}
          expandedFolders={new Set()}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      expect(screen.getByText('file1')).toBeTruthy();
      expect(screen.queryByText('file1.md')).toBeNull();
    });
  });

  describe('folder interaction', () => {
    it('calls onToggleFolder when folder is clicked', () => {
      const onToggleFolder = vi.fn();

      render(
        <FolderTree
          files={[]}
          folders={mockFolders}
          expandedFolders={new Set()}
          onToggleFolder={onToggleFolder}
          sourceId="test"
        />
      );

      const folderButton = screen.getByText('docs').closest('button');
      fireEvent.click(folderButton!);

      expect(onToggleFolder).toHaveBeenCalledWith('docs');
    });

    it('does not show nested content when folder is collapsed', () => {
      render(
        <FolderTree
          files={[]}
          folders={mockFolders}
          expandedFolders={new Set()}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      expect(screen.queryByText('nested')).toBeNull();
    });

    it('shows nested content when folder is expanded', () => {
      render(
        <FolderTree
          files={[]}
          folders={mockFolders}
          expandedFolders={new Set(['docs'])}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      expect(screen.getByText('nested')).toBeTruthy();
      expect(screen.getByText('drafts')).toBeTruthy();
    });

    it('shows deeply nested content when parent folders are expanded', () => {
      render(
        <FolderTree
          files={[]}
          folders={mockFolders}
          expandedFolders={new Set(['docs', 'docs/drafts'])}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      expect(screen.getByText('draft')).toBeTruthy();
    });
  });

  describe('file links', () => {
    it('generates correct href for files', () => {
      render(
        <FolderTree
          files={mockFiles}
          folders={[]}
          expandedFolders={new Set()}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      const link = screen.getByText('file1').closest('a');
      expect(link?.getAttribute('href')).toBe('/teleprompter?id=fs%3Atest%3Afile1.md');
    });

    it('generates correct href for nested files', () => {
      render(
        <FolderTree
          files={[]}
          folders={mockFolders}
          expandedFolders={new Set(['docs'])}
          onToggleFolder={vi.fn()}
          sourceId="test"
        />
      );

      const link = screen.getByText('nested').closest('a');
      expect(link?.getAttribute('href')).toBe('/teleprompter?id=fs%3Atest%3Adocs%2Fnested.md');
    });
  });
});
