import type { StorageSource, ScriptFile } from './types';

interface FileSystemDirectoryHandleWithIterator extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function buildFileId(sourceId: string, filename: string): string {
  return `fs:${sourceId}:${filename}`;
}

function parseFilename(fileId: string): string {
  const parts = fileId.split(':');
  if (parts.length < 3 || parts[0] !== 'fs') {
    throw new Error(`Invalid file ID format: ${fileId}`);
  }
  return parts.slice(2).join(':');
}

function removeExtension(filename: string): string {
  return filename.replace(/\.md$/, '');
}

async function collectMarkdownFiles(
  handle: FileSystemDirectoryHandleWithIterator
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      files.push(entry);
    }
  }
  return files;
}

export class FileSystemSource implements StorageSource {
  readonly type = 'file-system' as const;
  readonly readonly = true;

  constructor(
    private handle: FileSystemDirectoryHandle,
    public readonly id: string
  ) {}

  get name(): string {
    return this.handle.name;
  }

  async listFiles(): Promise<ScriptFile[]> {
    const fileHandles = await collectMarkdownFiles(
      this.handle as FileSystemDirectoryHandleWithIterator
    );
    return fileHandles.map((fileHandle) => ({
      id: buildFileId(this.id, fileHandle.name),
      name: removeExtension(fileHandle.name),
      sourceId: this.id,
    }));
  }

  async readFile(fileId: string): Promise<string> {
    const filename = parseFilename(fileId);
    const fileHandle = await this.handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file.text();
  }

  writeFile(): Promise<void> {
    throw new Error('File system sources are read-only');
  }

  deleteFile(): Promise<void> {
    throw new Error('File system sources are read-only');
  }

  renameFile(): Promise<void> {
    throw new Error('File system sources are read-only');
  }

  createFile(): Promise<ScriptFile> {
    throw new Error('File system sources are read-only');
  }
}
