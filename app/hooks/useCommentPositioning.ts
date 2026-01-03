'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Comment,
  PendingSelection,
  sortCommentsByTextPosition,
  getHighlightTopPosition,
  resolveCollisions,
  PENDING_COMMENT_ID,
  createPendingComment,
} from '@/app/lib/commentPositioning';
import { StrippedCommentRegion } from '@/app/lib/markerParser';

interface UseCommentPositioningProps {
  comments: Comment[];
  regions: StrippedCommentRegion[];
  highlightedCommentId: string | null;
  viewerContainerRef: React.RefObject<HTMLElement | null>;
  pendingSelection?: PendingSelection | null;
}

export function useCommentPositioning({
  comments,
  regions,
  highlightedCommentId,
  viewerContainerRef,
  pendingSelection = null,
}: UseCommentPositioningProps) {
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [heights, setHeights] = useState<Map<string, number>>(new Map());

  // Sort comments by text position (memoized), including pending comment if present
  const sortedComments = useMemo(() => {
    const baseComments = sortCommentsByTextPosition(comments, regions);

    if (!pendingSelection) return baseComments;

    // Add pending comment and re-sort
    const pendingComment = createPendingComment();
    const allComments = [...baseComments, pendingComment];

    // Create regions array including pending
    const allRegions = [
      ...regions,
      { commentId: PENDING_COMMENT_ID, start: pendingSelection.startIndex, end: pendingSelection.endIndex, selectedText: '' }
    ];

    return sortCommentsByTextPosition(allComments, allRegions);
  }, [comments, regions, pendingSelection]);

  // Calculate positions
  const updatePositions = useCallback(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const desiredPositions = new Map<string, number>();
    for (const comment of sortedComments) {
      if (comment.id === PENDING_COMMENT_ID && pendingSelection?.selectionTop !== undefined) {
        desiredPositions.set(comment.id, pendingSelection.selectionTop);
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
  }, [sortedComments, heights, highlightedCommentId, viewerContainerRef, pendingSelection]);

  // Update on scroll
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const handleScroll = () => updatePositions();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updatePositions, viewerContainerRef]);

  // Update on comment/highlight/pendingSelection changes, with RAF for DOM timing
  useEffect(() => {
    requestAnimationFrame(updatePositions);
  }, [updatePositions, comments, highlightedCommentId, pendingSelection]);

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
