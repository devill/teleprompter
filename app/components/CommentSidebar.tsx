import { useEffect, useRef } from 'react';
import styles from './CommentSidebar.module.css';
import { PENDING_COMMENT_ID } from '@/app/lib/commentPositioning';
import CommentForm from './CommentForm';

interface CommentAnchor {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  anchor: CommentAnchor;
  createdAt: string;
}

interface CommentSidebarProps {
  comments: Comment[];
  positions: Map<string, number>;
  highlightedCommentId: string | null;
  onCommentClick: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onHeightMeasured: (commentId: string, height: number) => void;
  pendingForm?: {
    onSubmit: (text: string) => void;
    onCancel: () => void;
  } | null;
  newlyCreatedCommentId?: string | null;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

export default function CommentSidebar({ comments, positions, highlightedCommentId, onCommentClick, onDelete, onHeightMeasured, pendingForm, newlyCreatedCommentId }: CommentSidebarProps) {
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const commentId = entry.target.getAttribute('data-comment-id');
        if (commentId) {
          onHeightMeasured(commentId, entry.contentRect.height);
        }
      }
    });

    cardRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [comments, pendingForm, onHeightMeasured]);

  if (comments.length === 0 && !pendingForm) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>No comments yet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ul className={styles.commentList}>
        {comments.filter(c => c.id !== PENDING_COMMENT_ID).map((comment) => {
          const isNew = comment.id === newlyCreatedCommentId;
          return (
          <li
            key={comment.id}
            className={`${styles.commentItem} ${isNew ? styles.newItem : ''}`}
            data-comment-id={comment.id}
            data-new={isNew ? 'true' : undefined}
            ref={(el) => {
              if (el) {
                cardRefs.current.set(comment.id, el);
              } else {
                cardRefs.current.delete(comment.id);
              }
            }}
            style={{
              position: 'absolute',
              top: `${positions.get(comment.id) ?? 0}px`,
              left: 0,
              right: 0,
            }}
          >
            <button
              data-comment-interactive
              className={`${styles.commentCard} ${highlightedCommentId === comment.id ? styles.highlighted : ''}`}
              onClick={() => onCommentClick(comment.id)}
            >
              <div className={styles.commentHeader}>
                <span className={styles.author}>{comment.author}</span>
                <span className={styles.timestamp}>{formatTimestamp(comment.createdAt)}</span>
              </div>
              <p className={styles.textSnippet}>{truncateText(comment.text, 100)}</p>
            </button>
            <button
              data-comment-interactive
              className={styles.deleteButton}
              onClick={() => onDelete(comment.id)}
              aria-label="Delete comment"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </li>
        );
        })}
        {pendingForm && (
          <li
            data-comment-interactive
            key={PENDING_COMMENT_ID}
            className={`${styles.commentItem} ${styles.formItem}`}
            data-comment-id={PENDING_COMMENT_ID}
            ref={(el) => {
              if (el) {
                cardRefs.current.set(PENDING_COMMENT_ID, el);
              } else {
                cardRefs.current.delete(PENDING_COMMENT_ID);
              }
            }}
            style={{
              position: 'absolute',
              top: `${positions.get(PENDING_COMMENT_ID) ?? 0}px`,
              left: 0,
              right: 0,
            }}
          >
            <CommentForm
              onSubmit={pendingForm.onSubmit}
              onCancel={pendingForm.onCancel}
            />
          </li>
        )}
      </ul>
    </div>
  );
}
