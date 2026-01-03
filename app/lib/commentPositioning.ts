export const PENDING_COMMENT_ID = '__pending__';

export interface PendingSelection {
  startIndex: number;
  endIndex: number;
  selectionTop: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

// Sort comments by their position in document using pre-parsed regions
export function sortCommentsByTextPosition(
  comments: Comment[],
  regions: Array<{ commentId: string; start: number }>
): Comment[] {
  const positionMap = new Map(regions.map(r => [r.commentId, r.start]));
  return [...comments].sort((a, b) => {
    const posA = positionMap.get(a.id) ?? 0;
    const posB = positionMap.get(b.id) ?? 0;
    return posA - posB;
  });
}

// Get Y position of highlight element relative to container
export function getHighlightTopPosition(
  commentId: string,
  containerElement: HTMLElement | null
): number | null {
  if (!containerElement) return null;
  const highlightSpan = containerElement.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement;
  if (!highlightSpan) return null;
  const containerRect = containerElement.getBoundingClientRect();
  const spanRect = highlightSpan.getBoundingClientRect();
  return spanRect.top - containerRect.top + containerElement.scrollTop;
}

// Collision resolution algorithm
export function resolveCollisions(
  sortedComments: Comment[],
  desiredPositions: Map<string, number>,
  heights: Map<string, number>,
  highlightedCommentId: string | null,
  gap: number = 12
): Map<string, number> {
  const result = new Map<string, number>();
  if (sortedComments.length === 0) return result;

  const highlightedIndex = highlightedCommentId
    ? sortedComments.findIndex(c => c.id === highlightedCommentId)
    : -1;

  // No selection: simple forward pass
  if (highlightedIndex === -1) {
    let previousBottom = 0;
    for (const comment of sortedComments) {
      const desired = desiredPositions.get(comment.id) ?? 0;
      const height = heights.get(comment.id) ?? 80;
      const actualTop = Math.max(desired, previousBottom);
      result.set(comment.id, actualTop);
      previousBottom = actualTop + height + gap;
    }
    return result;
  }

  // Anchor the selected comment at its desired position
  const selectedComment = sortedComments[highlightedIndex];
  const selectedTop = desiredPositions.get(selectedComment.id) ?? 0;
  result.set(selectedComment.id, selectedTop);

  // Work backwards for comments before the selection
  let nextTop = selectedTop;
  for (let i = highlightedIndex - 1; i >= 0; i--) {
    const comment = sortedComments[i];
    const desired = desiredPositions.get(comment.id) ?? 0;
    const height = heights.get(comment.id) ?? 80;
    const actualTop = Math.min(desired, nextTop - height - gap);
    result.set(comment.id, actualTop);
    nextTop = actualTop;
  }

  // Work forwards for comments after the selection
  let prevBottom = selectedTop + (heights.get(selectedComment.id) ?? 80) + gap;
  for (let i = highlightedIndex + 1; i < sortedComments.length; i++) {
    const comment = sortedComments[i];
    const desired = desiredPositions.get(comment.id) ?? 0;
    const height = heights.get(comment.id) ?? 80;
    const actualTop = Math.max(desired, prevBottom);
    result.set(comment.id, actualTop);
    prevBottom = actualTop + height + gap;
  }

  return result;
}

export function createPendingComment(): Comment {
  return {
    id: PENDING_COMMENT_ID,
    author: '',
    text: '',
    createdAt: new Date().toISOString(),
  };
}
