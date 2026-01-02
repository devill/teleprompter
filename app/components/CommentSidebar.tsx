import styles from './CommentSidebar.module.css';

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
  onCommentClick: (commentId: string) => void;
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

export default function CommentSidebar({ comments, onCommentClick }: CommentSidebarProps) {
  if (comments.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>No comments yet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ul className={styles.commentList}>
        {comments.map((comment) => (
          <li key={comment.id}>
            <button
              className={styles.commentCard}
              onClick={() => onCommentClick(comment.id)}
            >
              <div className={styles.commentHeader}>
                <span className={styles.author}>{comment.author}</span>
                <span className={styles.timestamp}>{formatTimestamp(comment.createdAt)}</span>
              </div>
              <p className={styles.textSnippet}>{truncateText(comment.text, 100)}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
