import { describe, it, expect, vi } from 'vitest';
import { countAllFiles, FileSystemSource } from './fileSystemSource';
import type { FileSystemContents, ScriptFile, FolderEntry } from './types';

// Mock types for FileSystemHandle
interface MockFileHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<{ text: () => Promise<string> }>;
}

interface MockDirectoryHandle {
  kind: 'directory';
  name: string;
  values: () => AsyncIterableIterator<MockFileHandle | MockDirectoryHandle>;
  getDirectoryHandle: (name: string) => Promise<MockDirectoryHandle>;
  getFileHandle: (name: string) => Promise<MockFileHandle>;
  requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
}

function createMockFileHandle(name: string, content: string): MockFileHandle {
  return {
    kind: 'file',
    name,
    getFile: () => Promise.resolve({
      text: () => Promise.resolve(content),
    }),
  };
}

function createMockDirectoryHandle(
  name: string,
  entries: (MockFileHandle | MockDirectoryHandle)[],
  subdirectories: Map<string, MockDirectoryHandle> = new Map(),
  files: Map<string, MockFileHandle> = new Map()
): MockDirectoryHandle {
  async function* valuesIterator() {
    for (const entry of entries) {
      yield entry;
    }
  }

  return {
    kind: 'directory',
    name,
    values: valuesIterator,
    getDirectoryHandle: async (subName: string) => {
      const dir = subdirectories.get(subName);
      if (!dir) {
        throw new Error(`Directory not found: ${subName}`);
      }
      return dir;
    },
    getFileHandle: async (fileName: string) => {
      const file = files.get(fileName);
      if (!file) {
        throw new Error(`File not found: ${fileName}`);
      }
      return file;
    },
  };
}

describe('countAllFiles', () => {
  describe('empty contents', () => {
    it('returns 0 for empty contents', () => {
      const contents: FileSystemContents = { files: [], folders: [] };
      expect(countAllFiles(contents)).toBe(0);
    });
  });

  describe('root-level files', () => {
    it('counts root-level files', () => {
      const files: ScriptFile[] = [
        { id: 'fs:test:file1.md', name: 'file1', sourceId: 'test' },
        { id: 'fs:test:file2.md', name: 'file2', sourceId: 'test' },
        { id: 'fs:test:file3.md', name: 'file3', sourceId: 'test' },
      ];
      const contents: FileSystemContents = { files, folders: [] };
      expect(countAllFiles(contents)).toBe(3);
    });
  });

  describe('nested folders', () => {
    it('counts files in nested folders recursively', () => {
      const rootFiles: ScriptFile[] = [
        { id: 'fs:test:root.md', name: 'root', sourceId: 'test' },
      ];

      const subfolderFiles: ScriptFile[] = [
        { id: 'fs:test:sub/file1.md', name: 'file1', sourceId: 'test' },
        { id: 'fs:test:sub/file2.md', name: 'file2', sourceId: 'test' },
      ];

      const deepSubfolderFiles: ScriptFile[] = [
        { id: 'fs:test:sub/deep/file.md', name: 'file', sourceId: 'test' },
      ];

      const deepSubfolder: FolderEntry = {
        name: 'deep',
        path: 'sub/deep',
        files: deepSubfolderFiles,
        subfolders: [],
      };

      const subfolder: FolderEntry = {
        name: 'sub',
        path: 'sub',
        files: subfolderFiles,
        subfolders: [deepSubfolder],
      };

      const contents: FileSystemContents = {
        files: rootFiles,
        folders: [subfolder],
      };

      expect(countAllFiles(contents)).toBe(4);
    });

    it('counts files across multiple sibling folders', () => {
      const folder1: FolderEntry = {
        name: 'folder1',
        path: 'folder1',
        files: [
          { id: 'fs:test:folder1/a.md', name: 'a', sourceId: 'test' },
          { id: 'fs:test:folder1/b.md', name: 'b', sourceId: 'test' },
        ],
        subfolders: [],
      };

      const folder2: FolderEntry = {
        name: 'folder2',
        path: 'folder2',
        files: [
          { id: 'fs:test:folder2/c.md', name: 'c', sourceId: 'test' },
        ],
        subfolders: [],
      };

      const contents: FileSystemContents = {
        files: [],
        folders: [folder1, folder2],
      };

      expect(countAllFiles(contents)).toBe(3);
    });
  });
});

describe('FileSystemSource', () => {
  describe('listContents', () => {
    it('returns correct structure for nested directories', async () => {
      const subFile = createMockFileHandle('nested.md', 'nested content');
      const subDir = createMockDirectoryHandle('docs', [subFile]);

      const rootFile = createMockFileHandle('readme.md', 'root content');
      const rootHandle = createMockDirectoryHandle('root', [rootFile, subDir]);

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      const contents = await source.listContents();

      expect(contents.files).toHaveLength(1);
      expect(contents.files[0].name).toBe('readme');
      expect(contents.files[0].id).toBe('fs:test-source:readme.md');

      expect(contents.folders).toHaveLength(1);
      expect(contents.folders[0].name).toBe('docs');
      expect(contents.folders[0].path).toBe('docs');
      expect(contents.folders[0].files).toHaveLength(1);
      expect(contents.folders[0].files[0].name).toBe('nested');
      expect(contents.folders[0].files[0].id).toBe('fs:test-source:docs/nested.md');
    });

    it('skips hidden directories', async () => {
      const hiddenFile = createMockFileHandle('secret.md', 'secret');
      const hiddenDir = createMockDirectoryHandle('.hidden', [hiddenFile]);

      const visibleFile = createMockFileHandle('visible.md', 'visible');
      const visibleDir = createMockDirectoryHandle('visible', [visibleFile]);

      const rootFile = createMockFileHandle('root.md', 'root');
      const rootHandle = createMockDirectoryHandle('root', [
        rootFile,
        hiddenDir,
        visibleDir,
      ]);

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      const contents = await source.listContents();

      expect(contents.folders).toHaveLength(1);
      expect(contents.folders[0].name).toBe('visible');
    });

    it('sorts files and folders alphabetically', async () => {
      const fileC = createMockFileHandle('charlie.md', 'c');
      const fileA = createMockFileHandle('alpha.md', 'a');
      const fileB = createMockFileHandle('bravo.md', 'b');

      const dirZulu = createMockDirectoryHandle('zulu', []);
      const dirAlpha = createMockDirectoryHandle('alpha-dir', []);
      const dirMike = createMockDirectoryHandle('mike', []);

      const rootHandle = createMockDirectoryHandle('root', [
        fileC,
        dirZulu,
        fileA,
        dirAlpha,
        fileB,
        dirMike,
      ]);

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      const contents = await source.listContents();

      expect(contents.files.map((f) => f.name)).toEqual(['alpha', 'bravo', 'charlie']);
      expect(contents.folders.map((f) => f.name)).toEqual(['alpha-dir', 'mike', 'zulu']);
    });

    it('only includes markdown files', async () => {
      const mdFile = createMockFileHandle('script.md', 'markdown');
      const txtFile = createMockFileHandle('notes.txt', 'text');
      const jsFile = createMockFileHandle('code.js', 'javascript');

      const rootHandle = createMockDirectoryHandle('root', [mdFile, txtFile, jsFile]);

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      const contents = await source.listContents();

      expect(contents.files).toHaveLength(1);
      expect(contents.files[0].name).toBe('script');
    });

    it('returns empty contents when permission not granted', async () => {
      const rootFile = createMockFileHandle('file.md', 'content');
      const rootHandle = createMockDirectoryHandle('root', [rootFile]);

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source',
        false // permission not granted
      );

      const contents = await source.listContents();

      expect(contents.files).toHaveLength(0);
      expect(contents.folders).toHaveLength(0);
    });
  });

  describe('readFile', () => {
    it('reads file at root level', async () => {
      const file = createMockFileHandle('script.md', 'Hello World');
      const files = new Map([['script.md', file]]);
      const rootHandle = createMockDirectoryHandle('root', [file], new Map(), files);

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      const content = await source.readFile('fs:test-source:script.md');
      expect(content).toBe('Hello World');
    });

    it('traverses nested paths correctly', async () => {
      const deepFile = createMockFileHandle('deep.md', 'Deep Content');
      const deepFiles = new Map([['deep.md', deepFile]]);
      const deepDir = createMockDirectoryHandle('level2', [deepFile], new Map(), deepFiles);

      const level1Dir = createMockDirectoryHandle(
        'level1',
        [deepDir],
        new Map([['level2', deepDir]])
      );

      const rootHandle = createMockDirectoryHandle(
        'root',
        [level1Dir],
        new Map([['level1', level1Dir]])
      );

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      const content = await source.readFile('fs:test-source:level1/level2/deep.md');
      expect(content).toBe('Deep Content');
    });

    it('handles colons in filename', async () => {
      const file = createMockFileHandle('file:with:colons.md', 'Colon Content');
      const files = new Map([['file:with:colons.md', file]]);
      const rootHandle = createMockDirectoryHandle('root', [file], new Map(), files);

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      const content = await source.readFile('fs:test-source:file:with:colons.md');
      expect(content).toBe('Colon Content');
    });
  });

  describe('read-only operations', () => {
    it('throws error on writeFile', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      expect(() => source.writeFile('id', 'content')).toThrow('read-only');
    });

    it('throws error on deleteFile', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      expect(() => source.deleteFile('id')).toThrow('read-only');
    });

    it('throws error on renameFile', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      expect(() => source.renameFile('id', 'new')).toThrow('read-only');
    });

    it('throws error on createFile', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      expect(() => source.createFile('name', 'content')).toThrow('read-only');
    });
  });

  describe('permission handling', () => {
    it('needsPermission returns true when not granted', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source',
        false
      );

      expect(source.needsPermission).toBe(true);
    });

    it('needsPermission returns false when granted', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source',
        true
      );

      expect(source.needsPermission).toBe(false);
    });

    it('requestPermission updates state on grant', async () => {
      const rootHandle = createMockDirectoryHandle('root', []) as MockDirectoryHandle;
      rootHandle.requestPermission = vi.fn().mockResolvedValue('granted');

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source',
        false
      );

      expect(source.needsPermission).toBe(true);

      const result = await source.requestPermission();

      expect(result).toBe(true);
      expect(source.needsPermission).toBe(false);
    });

    it('requestPermission returns false on denial', async () => {
      const rootHandle = createMockDirectoryHandle('root', []) as MockDirectoryHandle;
      rootHandle.requestPermission = vi.fn().mockResolvedValue('denied');

      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source',
        false
      );

      const result = await source.requestPermission();

      expect(result).toBe(false);
      expect(source.needsPermission).toBe(true);
    });
  });

  describe('properties', () => {
    it('has correct type', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      expect(source.type).toBe('file-system');
    });

    it('has readonly true', () => {
      const rootHandle = createMockDirectoryHandle('root', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      expect(source.readonly).toBe(true);
    });

    it('returns handle name as name', () => {
      const rootHandle = createMockDirectoryHandle('my-folder', []);
      const source = new FileSystemSource(
        rootHandle as unknown as FileSystemDirectoryHandle,
        'test-source'
      );

      expect(source.name).toBe('my-folder');
    });
  });
});
