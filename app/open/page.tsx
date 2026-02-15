'use client';

import { useStorageRegistry } from '@/app/hooks/useStorageRegistry';
import SourceList from '@/app/components/open/SourceList';
import styles from './page.module.css';

export default function OpenPage() {
  const {
    sources,
    isLoading,
    addFolder,
    removeFolder,
    isFileSystemSupported,
  } = useStorageRegistry();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Open Script</h1>
        <SourceList
          sources={sources}
          isLoading={isLoading}
          isFileSystemSupported={isFileSystemSupported}
          onAddFolder={addFolder}
          onRemoveFolder={removeFolder}
        />
      </div>
    </div>
  );
}
