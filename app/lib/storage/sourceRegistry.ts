import type { StorageSource } from './types';
import { myScriptsSource } from './myScriptsSource';
import { FileSystemSource, isFileSystemAccessSupported } from './fileSystemSource';
import { getAllFolderHandles, saveFolderHandle, deleteFolderHandle, StoredFolderHandle } from './db';

interface FileSystemHandleWithPermission extends FileSystemDirectoryHandle {
  requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

export interface SourceRegistry {
  getSources(): StorageSource[];
  getSource(id: string): StorageSource | undefined;
  addFolder(): Promise<StorageSource | null>;
  removeFolder(id: string): Promise<void>;
  initialize(): Promise<void>;
  getFile(fileId: string): Promise<{ source: StorageSource; content: string }>;
}

function createSourceRegistry(): SourceRegistry {
  const sources: Map<string, StorageSource> = new Map();

  sources.set(myScriptsSource.id, myScriptsSource);

  async function restoreFolderHandles(): Promise<void> {
    if (!isFileSystemAccessSupported()) return;

    const storedHandles = await getAllFolderHandles();

    for (const stored of storedHandles) {
      try {
        const handle = stored.handle as FileSystemHandleWithPermission;
        const permission = await handle.requestPermission({ mode: 'read' });
        if (permission === 'granted') {
          const source = new FileSystemSource(stored.handle, stored.id);
          sources.set(stored.id, source);
        } else {
          await deleteFolderHandle(stored.id);
        }
      } catch {
        await deleteFolderHandle(stored.id);
      }
    }
  }

  function parseFileIdSource(fileId: string): string {
    if (fileId.startsWith('my-scripts:')) {
      return 'my-scripts';
    }
    if (fileId.startsWith('fs:')) {
      const parts = fileId.split(':');
      if (parts.length >= 3) {
        return parts[1];
      }
    }
    throw new Error(`Unknown file ID format: ${fileId}`);
  }

  return {
    getSources(): StorageSource[] {
      return Array.from(sources.values());
    },

    getSource(id: string): StorageSource | undefined {
      return sources.get(id);
    },

    async addFolder(): Promise<StorageSource | null> {
      if (!isFileSystemAccessSupported()) return null;

      try {
        const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        const id = crypto.randomUUID();
        const source = new FileSystemSource(handle, id);

        const stored: StoredFolderHandle = { id, name: handle.name, handle };
        await saveFolderHandle(stored);

        sources.set(id, source);
        return source;
      } catch {
        return null;
      }
    },

    async removeFolder(id: string): Promise<void> {
      if (id === 'my-scripts') return;
      sources.delete(id);
      await deleteFolderHandle(id);
    },

    async initialize(): Promise<void> {
      await restoreFolderHandles();
    },

    async getFile(fileId: string): Promise<{ source: StorageSource; content: string }> {
      const sourceId = parseFileIdSource(fileId);
      const source = sources.get(sourceId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }
      const content = await source.readFile(fileId);
      return { source, content };
    },
  };
}

export const sourceRegistry = createSourceRegistry();
