export interface TextSelectionData {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  anchor: TextSelectionData;
  createdAt: string;
}

// Find position of anchor in content (extract from existing viewers)
export function findTextPosition(content: string, anchor: TextSelectionData): number {
  const fullPattern = anchor.contextBefore + anchor.selectedText + anchor.contextAfter;
  const patternIndex = content.indexOf(fullPattern);
  if (patternIndex !== -1) {
    return patternIndex + anchor.contextBefore.length;
  }
  return content.indexOf(anchor.selectedText);
}

// Sort comments by their position in document
export function sortCommentsByTextPosition(comments: Comment[], content: string): Comment[] {
  return [...comments].sort((a, b) => {
    const posA = findTextPosition(content, a.anchor);
    const posB = findTextPosition(content, b.anchor);
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
