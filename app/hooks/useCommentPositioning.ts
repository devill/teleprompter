'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Comment,
  TextSelectionData,
  sortCommentsByTextPosition,
  getHighlightTopPosition,
  resolveCollisions,
  PENDING_COMMENT_ID,
  createPendingComment,
} from '@/app/lib/commentPositioning';

interface UseCommentPositioningProps {
  comments: Comment[];
  content: string;
  highlightedCommentId: string | null;
  viewerContainerRef: React.RefObject<HTMLElement | null>;
  pendingAnchor?: TextSelectionData | null;
}

export function useCommentPositioning({
  comments,
  content,
  highlightedCommentId,
  viewerContainerRef,
  pendingAnchor = null,
}: UseCommentPositioningProps) {
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [heights, setHeights] = useState<Map<string, number>>(new Map());

  // Sort comments by text position (memoized), including pending comment if present
  const sortedComments = useMemo(() => {
    const baseComments = sortCommentsByTextPosition(comments, content);
    if (!pendingAnchor) return baseComments;

    const pendingComment = createPendingComment(pendingAnchor);
    const allComments = [...baseComments, pendingComment];
    return sortCommentsByTextPosition(allComments, content);
  }, [comments, content, pendingAnchor]);

  // Calculate positions
  const updatePositions = useCallback(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const desiredPositions = new Map<string, number>();
    for (const comment of sortedComments) {
      if (comment.id === PENDING_COMMENT_ID && pendingAnchor?.selectionTop !== undefined) {
        desiredPositions.set(comment.id, pendingAnchor.selectionTop);
      } else {
        const top = getHighlightTopPosition(comment.id, container);
        if (top !== null) {
          desiredPositions.set(comment.id, top);
        }
      }
    }

    const finalPositions = resolveCollisions(
      sortedComments,
      desiredPositions,
      heights,
      highlightedCommentId
    );

    setPositions(finalPositions);
  }, [sortedComments, heights, highlightedCommentId, viewerContainerRef, pendingAnchor]);

  // Update on scroll
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const handleScroll = () => updatePositions();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updatePositions, viewerContainerRef]);

  // Update on comment/highlight/pendingAnchor changes, with RAF for DOM timing
  useEffect(() => {
    requestAnimationFrame(updatePositions);
  }, [updatePositions, comments, highlightedCommentId, pendingAnchor]);

  // Callback for CommentSidebar to report card heights
  const setCommentHeight = useCallback((commentId: string, height: number) => {
    setHeights(prev => {
      if (prev.get(commentId) === height) return prev;
      const next = new Map(prev);
      next.set(commentId, height);
      return next;
    });
  }, []);

  return {
    positions,
    sortedComments,
    setCommentHeight,
  };
}
