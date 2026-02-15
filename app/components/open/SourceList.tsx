'use client';

import { useState } from 'react';
import { StorageSource, ScriptFile } from '@/app/lib/storage';
import { useScriptList } from '@/app/hooks/useScriptList';
import FileList from './FileList';
import styles from './SourceList.module.css';

interface SourceItemProps {
  source: StorageSource;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onNewScript?: () => void;
  onReconnectFolder?: () => Promise<void>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`${styles.expandIcon} ${expanded ? styles.expandIconExpanded : ''}`}
      width="20"
      height="20"
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
      width="20"
      height="20"
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

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3V13M3 8H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4L4 12M4 4L12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function generateUniqueName(files: ScriptFile[]): string {
  const baseName = 'Untitled Script';
  const existingNames = new Set(files.map(f => f.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}

function SourceItem({
  source,
  isExpanded,
  onToggle,
  onRemove,
  onNewScript,
  onReconnectFolder,
}: SourceItemProps) {
  const { files, isLoading, refresh } = useScriptList(source.id);
  const isMyScripts = source.type === 'my-scripts';
  const needsPermission = source.needsPermission === true;

  async function handleDelete(fileId: string) {
    await source.deleteFile(fileId);
    refresh();
  }

  async function handleRename(fileId: string, newName: string) {
    await source.renameFile(fileId, newName);
    refresh();
  }

  async function handleNewScript() {
    const name = generateUniqueName(files);
    await source.createFile(name, '');
    refresh();
    onNewScript?.();
  }

  async function handleGrantAccess() {
    await onReconnectFolder?.();
    refresh();
  }

  return (
    <div className={styles.source}>
      <div
        className={styles.sourceHeader}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className={styles.sourceHeaderLeft}>
          <ChevronIcon expanded={isExpanded} />
          <FolderIcon />
          <span className={styles.sourceName}>{source.name}</span>
          {!needsPermission && (
            <span className={styles.fileCount}>
              {isLoading ? '...' : files.length}
            </span>
          )}
        </div>
        <div className={styles.sourceHeaderRight}>
          {needsPermission && onReconnectFolder && (
            <button
              className={styles.grantAccessButton}
              onClick={(e) => {
                e.stopPropagation();
                handleGrantAccess();
              }}
              type="button"
              title="Grant access to this folder"
            >
              Grant Access
            </button>
          )}
          {isMyScripts && (
            <button
              className={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                handleNewScript();
              }}
              type="button"
              title="New Script"
              aria-label="Create new script"
            >
              <PlusIcon />
            </button>
          )}
          {onRemove && (
            <button
              className={`${styles.actionButton} ${styles.removeButton}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              type="button"
              title="Remove folder"
              aria-label={`Remove ${source.name} folder`}
            >
              <RemoveIcon />
            </button>
          )}
        </div>
      </div>
      {!needsPermission && (
        <div
          className={`${styles.sourceContent} ${!isExpanded ? styles.sourceContentCollapsed : ''}`}
        >
          <FileList
            files={files}
            isLoading={isLoading}
            showDelete={isMyScripts}
            onDelete={handleDelete}
            onRename={isMyScripts ? handleRename : undefined}
          />
        </div>
      )}
    </div>
  );
}

interface SourceListProps {
  sources: StorageSource[];
  isLoading: boolean;
  isFileSystemSupported: boolean;
  onAddFolder: () => Promise<void>;
  onRemoveFolder: (id: string) => Promise<void>;
  onReconnectFolder: (id: string) => Promise<void>;
}

export default function SourceList({
  sources,
  isLoading,
  isFileSystemSupported,
  onAddFolder,
  onRemoveFolder,
  onReconnectFolder,
}: SourceListProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(['my-scripts'])
  );

  function toggleSource(sourceId: string) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }

  const sortedSources = [...sources].sort((a, b) => {
    if (a.type === 'my-scripts') return -1;
    if (b.type === 'my-scripts') return 1;
    return a.name.localeCompare(b.name);
  });

  if (isLoading) {
    return <div className={styles.loading}>Loading sources...</div>;
  }

  return (
    <div className={styles.container}>
      {sortedSources.map((source) => (
        <SourceItem
          key={source.id}
          source={source}
          isExpanded={expandedSources.has(source.id)}
          onToggle={() => toggleSource(source.id)}
          onRemove={
            source.type === 'file-system'
              ? () => onRemoveFolder(source.id)
              : undefined
          }
          onReconnectFolder={
            source.type === 'file-system'
              ? () => onReconnectFolder(source.id)
              : undefined
          }
        />
      ))}

      {isFileSystemSupported && (
        <div className={styles.toolbar}>
          <button
            className={styles.toolbarButton}
            onClick={onAddFolder}
            type="button"
          >
            <PlusIcon />
            <span>Add Folder</span>
          </button>
        </div>
      )}
    </div>
  );
}
