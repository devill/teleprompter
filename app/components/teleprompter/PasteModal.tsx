'use client';

import { useEffect, useRef } from 'react';
import styles from './PasteModal.module.css';

interface PasteModalProps {
  isOpen: boolean;
  scriptName: string;
  canReplace: boolean;
  onReplace: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export default function PasteModal({
  isOpen,
  scriptName,
  canReplace,
  onReplace,
  onCreateNew,
  onCancel,
}: PasteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop}>
      <div ref={modalRef} className={styles.modal}>
        <h2 className={styles.title}>Paste Content</h2>

        <p className={styles.message}>
          You have content in your clipboard. What would you like to do?
        </p>

        <p className={styles.scriptName}>
          Current script: <strong>{scriptName}</strong>
        </p>

        <div className={styles.buttons}>
          <button
            className={styles.replaceButton}
            onClick={onReplace}
            disabled={!canReplace}
            title={canReplace ? `Replace content in "${scriptName}"` : 'Cannot edit read-only scripts'}
          >
            Replace
          </button>
          <button
            className={styles.createButton}
            onClick={onCreateNew}
          >
            Create New
          </button>
          <button
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>

        {!canReplace && (
          <p className={styles.hint}>
            Replace is disabled because this script is read-only.
          </p>
        )}
      </div>
    </div>
  );
}
