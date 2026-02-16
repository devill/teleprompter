import type { StorageSource } from './types';
import { myScriptsSource } from './myScriptsSource';
import { FileSystemSource, isFileSystemAccessSupported } from './fileSystemSource';
import { getAllFolderHandles, saveFolderHandle, deleteFolderHandle, StoredFolderHandle } from './db';

interface FileSystemHandleWithPermission extends FileSystemDirectoryHandle {
  requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

export interface SourceRegistry {
  getSources(): StorageSource[];
  getSource(id: string): StorageSource | undefined;
  addFolder(): Promise<StorageSource | null>;
  removeFolder(id: string): Promise<void>;
  initialize(): Promise<void>;
  getFile(fileId: string): Promise<{ source: StorageSource; content: string }>;
  reconnectFolder(id: string): Promise<boolean>;
}

function createSourceRegistry(): SourceRegistry {
  const sources: Map<string, StorageSource> = new Map();
  let initializePromise: Promise<void> | null = null;

  sources.set(myScriptsSource.id, myScriptsSource);

  async function restoreFolderHandles(): Promise<void> {
    if (!isFileSystemAccessSupported()) return;

    const storedHandles = await getAllFolderHandles();

    for (const stored of storedHandles) {
      let permissionGranted = false;
      try {
        const handle = stored.handle as FileSystemHandleWithPermission;
        const permission = await handle.queryPermission({ mode: 'read' });
        permissionGranted = permission === 'granted';
      } catch {
        permissionGranted = false;
      }
      const source = new FileSystemSource(stored.handle, stored.id, permissionGranted);
      sources.set(stored.id, source);
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
      if (!initializePromise) {
        initializePromise = restoreFolderHandles();
      }
      await initializePromise;
    },

    async getFile(fileId: string): Promise<{ source: StorageSource; content: string }> {
      // Ensure initialization is complete before looking up sources
      if (!initializePromise) {
        initializePromise = restoreFolderHandles();
      }
      await initializePromise;

      const sourceId = parseFileIdSource(fileId);
      const source = sources.get(sourceId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }
      const content = await source.readFile(fileId);
      return { source, content };
    },

    async reconnectFolder(id: string): Promise<boolean> {
      const source = sources.get(id);
      if (!source || source.type !== 'file-system') return false;
      const fsSource = source as FileSystemSource;
      if (!fsSource.needsPermission) return true;
      const granted = await fsSource.requestPermission();
      return granted;
    },
  };
}

export const sourceRegistry = createSourceRegistry();
