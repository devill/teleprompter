'use client';

import Link from 'next/link';
import { ScriptFile, FolderEntry } from '@/app/lib/storage';
import styles from './FolderTree.module.css';

interface FolderTreeProps {
  files: ScriptFile[];
  folders: FolderEntry[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  sourceId: string;
  depth?: number;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ''}`}
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 5L12 10L7 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      className={styles.folderIcon}
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 5C2 4.44772 2.44772 4 3 4H7.58579C7.851 4 8.10536 4.10536 8.29289 4.29289L9.70711 5.70711C9.89464 5.89464 10.149 6 10.4142 6H17C17.5523 6 18 6.44772 18 7V15C18 15.5523 17.5523 16 17 16H3C2.44772 16 2 15.5523 2 15V5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      className={styles.fileIcon}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 2C3 1.44772 3.44772 1 4 1H9L13 5V14C13 14.5523 12.5523 15 12 15H4C3.44772 15 3 14.5523 3 14V2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 1V5H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatFileName(name: string): string {
  if (name.endsWith('.md')) {
    return name.slice(0, -3);
  }
  return name;
}

export default function FolderTree({
  files,
  folders,
  expandedFolders,
  onToggleFolder,
  sourceId,
  depth = 0,
}: FolderTreeProps) {
  const indentStyle = { paddingLeft: `calc(var(--space-8) + ${depth * 16}px)` };

  return (
    <ul className={styles.list}>
      {folders.map((folder) => {
        const isExpanded = expandedFolders.has(folder.path);
        return (
          <li key={folder.path} className={styles.folderItem}>
            <button
              className={styles.folderRow}
              style={indentStyle}
              onClick={() => onToggleFolder(folder.path)}
              type="button"
            >
              <ChevronIcon expanded={isExpanded} />
              <FolderIcon />
              <span className={styles.folderName}>{folder.name}</span>
            </button>
            {isExpanded && (
              <FolderTree
                files={folder.files}
                folders={folder.subfolders}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                sourceId={sourceId}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
      {files.map((file) => (
        <li key={file.id} className={styles.fileItem}>
          <Link
            href={`/teleprompter?id=${encodeURIComponent(file.id)}`}
            className={styles.fileLink}
            style={indentStyle}
          >
            <FileIcon />
            <span>{formatFileName(file.name)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
