'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Comment,
  sortCommentsByTextPosition,
  getHighlightTopPosition,
  resolveCollisions
} from '@/app/lib/commentPositioning';

interface UseCommentPositioningProps {
  comments: Comment[];
  content: string;
  highlightedCommentId: string | null;
  viewerContainerRef: React.RefObject<HTMLElement | null>;
}

export function useCommentPositioning({
  comments,
  content,
  highlightedCommentId,
  viewerContainerRef,
}: UseCommentPositioningProps) {
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [heights, setHeights] = useState<Map<string, number>>(new Map());

  // Sort comments by text position (memoized)
  const sortedComments = useMemo(
    () => sortCommentsByTextPosition(comments, content),
    [comments, content]
  );

  // Calculate positions
  const updatePositions = useCallback(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const desiredPositions = new Map<string, number>();
    for (const comment of sortedComments) {
      const top = getHighlightTopPosition(comment.id, container);
      if (top !== null) {
        desiredPositions.set(comment.id, top);
      }
    }

    const finalPositions = resolveCollisions(
      sortedComments,
      desiredPositions,
      heights,
      highlightedCommentId
    );

    setPositions(finalPositions);
  }, [sortedComments, heights, highlightedCommentId, viewerContainerRef]);

  // Update on scroll
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const handleScroll = () => updatePositions();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updatePositions, viewerContainerRef]);

  // Update on comment/highlight changes, with RAF for DOM timing
  useEffect(() => {
    requestAnimationFrame(updatePositions);
  }, [updatePositions, comments, highlightedCommentId]);

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
