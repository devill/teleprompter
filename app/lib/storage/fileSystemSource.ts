import type { StorageSource, ScriptFile, FolderEntry, FileSystemContents } from './types';

interface FileSystemDirectoryHandleWithIterator extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

interface FileSystemHandleWithPermission extends FileSystemDirectoryHandle {
  requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
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

function isHiddenDirectory(name: string): boolean {
  return name.startsWith('.');
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

async function collectContents(
  handle: FileSystemDirectoryHandleWithIterator,
  sourceId: string,
  currentPath: string
): Promise<FileSystemContents> {
  const files: ScriptFile[] = [];
  const folders: FolderEntry[] = [];

  const fileHandles: FileSystemFileHandle[] = [];
  const dirHandles: FileSystemDirectoryHandle[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      fileHandles.push(entry);
    } else if (entry.kind === 'directory' && !isHiddenDirectory(entry.name)) {
      dirHandles.push(entry);
    }
  }

  fileHandles.sort((a, b) => a.name.localeCompare(b.name));
  dirHandles.sort((a, b) => a.name.localeCompare(b.name));

  for (const fileHandle of fileHandles) {
    const relativePath = currentPath ? `${currentPath}/${fileHandle.name}` : fileHandle.name;
    files.push({
      id: buildFileId(sourceId, relativePath),
      name: removeExtension(fileHandle.name),
      sourceId,
    });
  }

  for (const dirHandle of dirHandles) {
    const folderPath = currentPath ? `${currentPath}/${dirHandle.name}` : dirHandle.name;
    const subContents = await collectContents(
      dirHandle as FileSystemDirectoryHandleWithIterator,
      sourceId,
      folderPath
    );
    folders.push({
      name: dirHandle.name,
      path: folderPath,
      files: subContents.files,
      subfolders: subContents.folders,
    });
  }

  return { files, folders };
}

export function countAllFiles(contents: FileSystemContents): number {
  let count = contents.files.length;
  for (const folder of contents.folders) {
    count += countAllFiles({ files: folder.files, folders: folder.subfolders });
  }
  return count;
}

export class FileSystemSource implements StorageSource {
  readonly type = 'file-system' as const;
  readonly readonly = true;
  private permissionGranted: boolean;

  constructor(
    private handle: FileSystemDirectoryHandle,
    public readonly id: string,
    permissionGranted = true
  ) {
    this.permissionGranted = permissionGranted;
  }

  get needsPermission(): boolean {
    return !this.permissionGranted;
  }

  async requestPermission(): Promise<boolean> {
    const handle = this.handle as FileSystemHandleWithPermission;
    const result = await handle.requestPermission({ mode: 'read' });
    if (result === 'granted') {
      this.permissionGranted = true;
      return true;
    }
    return false;
  }

  get name(): string {
    return this.handle.name;
  }

  async listFiles(): Promise<ScriptFile[]> {
    if (!this.permissionGranted) {
      return [];
    }
    const fileHandles = await collectMarkdownFiles(
      this.handle as FileSystemDirectoryHandleWithIterator
    );
    return fileHandles.map((fileHandle) => ({
      id: buildFileId(this.id, fileHandle.name),
      name: removeExtension(fileHandle.name),
      sourceId: this.id,
    }));
  }

  async listContents(): Promise<FileSystemContents> {
    if (!this.permissionGranted) {
      return { files: [], folders: [] };
    }
    return collectContents(
      this.handle as FileSystemDirectoryHandleWithIterator,
      this.id,
      ''
    );
  }

  async readFile(fileId: string): Promise<string> {
    const relativePath = parseFilename(fileId);
    const pathSegments = relativePath.split('/');
    const filename = pathSegments.pop()!;

    let currentHandle: FileSystemDirectoryHandle = this.handle;
    for (const segment of pathSegments) {
      currentHandle = await currentHandle.getDirectoryHandle(segment);
    }

    const fileHandle = await currentHandle.getFileHandle(filename);
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
