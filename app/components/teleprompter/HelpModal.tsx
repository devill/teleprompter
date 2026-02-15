'use client';

import { useEffect, useRef } from 'react';
import styles from './HelpModal.module.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop}>
      <div ref={modalRef} className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose} title="Close">
          ×
        </button>

        <h2 className={styles.title}>Teleprompter Help</h2>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Voice Commands</h3>
          <dl className={styles.commandList}>
            <dt>please jump to [text]</dt>
            <dd>Jump to matching text in script</dd>

            <dt>please jump back [number]</dt>
            <dd>Jump back N paragraphs</dd>

            <dt>please jump forward [number]</dt>
            <dd>Jump forward N paragraphs</dd>

            <dt>please jump to section start</dt>
            <dd>Jump to start of current section</dd>

            <dt>please jump to previous section</dt>
            <dd>Jump to previous section heading</dd>

            <dt>please jump to next section</dt>
            <dd>Jump to next section heading</dd>
          </dl>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Keyboard Shortcuts</h3>
          <dl className={styles.commandList}>
            <dt>↑ / ↓</dt>
            <dd>Navigate between sections</dd>

            <dt>← / →</dt>
            <dd>Navigate between paragraphs</dd>

            <dt>Page Up / Page Down</dt>
            <dd>Scroll by page</dd>

            <dt>Space</dt>
            <dd>Toggle pause</dd>

            <dt>Escape</dt>
            <dd>Exit fullscreen</dd>

            <dt>Cmd/Ctrl+V</dt>
            <dd>Paste script</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
