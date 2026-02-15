'use client';

import { useStorageRegistry } from '@/app/hooks/useStorageRegistry';
import { useScriptList } from '@/app/hooks/useScriptList';
import { usePasteHandler } from '@/app/hooks/usePasteHandler';
import SourceList from '@/app/components/open/SourceList';
import styles from './page.module.css';

export default function OpenPage() {
  const {
    sources,
    isLoading,
    addFolder,
    removeFolder,
    reconnectFolder,
    isFileSystemSupported,
  } = useStorageRegistry();

  const { files } = useScriptList('my-scripts');
  const scriptNames = files.map(f => f.name);
  usePasteHandler(scriptNames);

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
          onReconnectFolder={async (id) => { await reconnectFolder(id); }}
        />
      </div>
    </div>
  );
}
