export interface ScriptFile {
  id: string;
  name: string;
  sourceId: string;
}

export interface StorageSourceInfo {
  id: string;
  name: string;
  type: 'my-scripts' | 'file-system';
  readonly: boolean;
  needsPermission?: boolean;
}

export interface StorageSource extends StorageSourceInfo {
  listFiles(): Promise<ScriptFile[]>;
  readFile(id: string): Promise<string>;
  writeFile(id: string, content: string): Promise<void>;
  deleteFile(id: string): Promise<void>;
  renameFile(id: string, newName: string): Promise<void>;
  createFile(name: string, content: string): Promise<ScriptFile>;
  requestPermission?(): Promise<boolean>;
}

export interface FolderEntry {
  name: string;
  path: string;  // relative path from source root, e.g., "docs" or "docs/drafts"
  files: ScriptFile[];
  subfolders: FolderEntry[];
}

export interface FileSystemContents {
  files: ScriptFile[];     // files at root level
  folders: FolderEntry[];  // subdirectories
}
