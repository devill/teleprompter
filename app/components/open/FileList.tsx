'use client';

import { useRouter } from 'next/navigation';
import { ScriptFile } from '@/app/lib/storage';
import styles from './FileList.module.css';

interface FileListProps {
  files: ScriptFile[];
  isLoading: boolean;
  showDelete: boolean;
  onDelete?: (fileId: string) => void;
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

function DeleteIcon() {
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

function formatFileName(file: ScriptFile): string {
  const name = file.name;
  if (name.endsWith('.md')) {
    return name.slice(0, -3);
  }
  return name;
}

export default function FileList({
  files,
  isLoading,
  showDelete,
  onDelete,
}: FileListProps) {
  const router = useRouter();

  function handleFileClick(file: ScriptFile) {
    router.push(`/teleprompter?id=${encodeURIComponent(file.id)}`);
  }

  function handleDelete(event: React.MouseEvent, fileId: string) {
    event.stopPropagation();
    onDelete?.(fileId);
  }

  if (isLoading) {
    return <div className={styles.loading}>Loading files...</div>;
  }

  if (files.length === 0) {
    return <div className={styles.empty}>No scripts yet</div>;
  }

  return (
    <ul className={styles.list}>
      {files.map((file) => (
        <li key={file.id} className={styles.item}>
          <button
            className={styles.fileLink}
            onClick={() => handleFileClick(file)}
            type="button"
          >
            <FileIcon />
            <span>{formatFileName(file)}</span>
          </button>
          {showDelete && onDelete && (
            <button
              className={styles.deleteButton}
              onClick={(e) => handleDelete(e, file.id)}
              type="button"
              title="Delete script"
              aria-label={`Delete ${file.name}`}
            >
              <DeleteIcon />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
