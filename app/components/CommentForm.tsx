'use client';

import { useState } from 'react';
import styles from './CommentForm.module.css';

interface CommentFormProps {
  selectedText: string;
  onSubmit: (commentText: string) => void;
  onCancel: () => void;
}

export default function CommentForm({ selectedText, onSubmit, onCancel }: CommentFormProps) {
  const [commentText, setCommentText] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedText = commentText.trim();
    if (trimmedText) {
      onSubmit(trimmedText);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.selectedTextPreview}>
        <span className={styles.previewLabel}>Commenting on:</span>
        <p className={styles.previewText}>{selectedText}</p>
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write your comment..."
          rows={4}
          autoFocus
        />
        <div className={styles.buttonGroup}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.submitButton} disabled={!commentText.trim()}>
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
