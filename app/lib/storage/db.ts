const DB_NAME = 'teleprompter-storage';
const DB_VERSION = 1;

export interface StoredScript {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredFolderHandle {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('scripts')) {
        db.createObjectStore('scripts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('folder-handles')) {
        db.createObjectStore('folder-handles', { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

export async function getAllScripts(): Promise<StoredScript[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scripts', 'readonly');
    const store = tx.objectStore('scripts');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getScript(id: string): Promise<StoredScript | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scripts', 'readonly');
    const store = tx.objectStore('scripts');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveScript(script: StoredScript): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scripts', 'readwrite');
    const store = tx.objectStore('scripts');
    const request = store.put(script);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteScript(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scripts', 'readwrite');
    const store = tx.objectStore('scripts');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFolderHandles(): Promise<StoredFolderHandle[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folder-handles', 'readonly');
    const store = tx.objectStore('folder-handles');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFolderHandle(handle: StoredFolderHandle): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folder-handles', 'readwrite');
    const store = tx.objectStore('folder-handles');
    const request = store.put(handle);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFolderHandle(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folder-handles', 'readwrite');
    const store = tx.objectStore('folder-handles');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
