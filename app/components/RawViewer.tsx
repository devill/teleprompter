'use client';

import { useCallback, useMemo } from 'react';
import styles from './RawViewer.module.css';

interface TextSelectionData {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  selectionTop: number;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  anchor: TextSelectionData;
  createdAt: string;
}

interface RawViewerProps {
  content: string;
  comments: Comment[];
  highlightedCommentId: string | null;
  onTextSelect: (data: TextSelectionData) => void;
  onHighlightClick: (commentId: string) => void;
  onSelectionMade?: () => void;
  containerRef?: React.RefObject<HTMLPreElement | null>;
}

function findTextPosition(content: string, anchor: TextSelectionData): number {
  const fullPattern = anchor.contextBefore + anchor.selectedText + anchor.contextAfter;
  const patternIndex = content.indexOf(fullPattern);
  if (patternIndex !== -1) {
    return patternIndex + anchor.contextBefore.length;
  }
  return content.indexOf(anchor.selectedText);
}

interface HighlightRegion {
  start: number;
  end: number;
  commentId: string;
}

export default function RawViewer({
  content,
  comments,
  highlightedCommentId,
  onTextSelect,
  onHighlightClick,
  onSelectionMade,
  containerRef,
}: RawViewerProps) {
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString();
    if (!selectedText.trim()) {
      return;
    }

    const selectionStart = content.indexOf(selectedText);
    if (selectionStart === -1) {
      return;
    }

    const contextBefore = content.slice(Math.max(0, selectionStart - 50), selectionStart);
    const contextAfter = content.slice(
      selectionStart + selectedText.length,
      selectionStart + selectedText.length + 50
    );

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef?.current?.getBoundingClientRect();
    const scrollTop = containerRef?.current?.scrollTop ?? 0;
    const selectionTop = containerRect
      ? rect.top - containerRect.top + scrollTop
      : 0;

    // Signal that a selection was made
    onSelectionMade?.();

    onTextSelect({
      selectedText,
      contextBefore,
      contextAfter,
      selectionTop,
    });
  }, [content, onTextSelect, onSelectionMade, containerRef]);

  const highlightRegions = useMemo((): HighlightRegion[] => {
    return comments
      .map((comment) => {
        const start = findTextPosition(content, comment.anchor);
        if (start === -1) return null;
        return {
          start,
          end: start + comment.anchor.selectedText.length,
          commentId: comment.id,
        };
      })
      .filter((region): region is HighlightRegion => region !== null)
      .sort((a, b) => a.start - b.start);
  }, [content, comments]);

  const renderContentWithHighlights = useMemo(() => {
    if (highlightRegions.length === 0) {
      return content;
    }

    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    highlightRegions.forEach((region, index) => {
      if (region.start > lastEnd) {
        segments.push(content.slice(lastEnd, region.start));
      }

      const isHighlighted = region.commentId === highlightedCommentId;
      segments.push(
        <span
          key={`highlight-${index}`}
          data-comment-interactive
          className={`${styles.commentHighlight} ${isHighlighted ? styles.commentHighlightActive : ''}`}
          data-comment-id={region.commentId}
          onClick={(e) => {
            e.stopPropagation();
            onHighlightClick(region.commentId);
          }}
        >
          {content.slice(region.start, region.end)}
        </span>
      );

      lastEnd = region.end;
    });

    if (lastEnd < content.length) {
      segments.push(content.slice(lastEnd));
    }

    return segments;
  }, [content, highlightRegions, highlightedCommentId, onHighlightClick]);

  return (
    <pre ref={containerRef} className={styles.container} onMouseUp={handleMouseUp}>
      {renderContentWithHighlights}
    </pre>
  );
}
