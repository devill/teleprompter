'use client';

import { useState } from 'react';
import styles from './NamePrompt.module.css';

interface NamePromptProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export default function NamePrompt({ onSubmit, onCancel }: NamePromptProps) {
  const [name, setName] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      onSubmit(trimmedName);
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="nameInput">
            Enter your name to comment
          </label>
          <input
            id="nameInput"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          <div className={styles.buttonGroup}>
            <button type="button" className={styles.cancelButton} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton} disabled={!name.trim()}>
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
