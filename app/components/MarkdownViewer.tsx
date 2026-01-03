'use client';

import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { StrippedCommentRegion } from '@/app/lib/markerParser';
import styles from './MarkdownViewer.module.css';

interface MarkdownViewerProps {
  content: string;  // This is now STRIPPED content (no markers)
  regions: StrippedCommentRegion[];  // Pre-parsed comment regions
  highlightedCommentId: string | null;
  pendingRegion?: { start: number; end: number } | null;  // Simpler than before
  onTextSelect: (data: { startIndex: number; endIndex: number; selectionTop: number }) => void;
  onHighlightClick: (commentId: string) => void;
  onSelectionMade?: () => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

interface HighlightRegion {
  start: number;
  end: number;
  commentId: string;
}

interface HighlightedTextProps {
  text: string;
  regions: HighlightRegion[];
  contentStartIndex: number;
  highlightedCommentId: string | null;
  onHighlightClick: (commentId: string) => void;
}

function HighlightedText({
  text,
  regions,
  contentStartIndex,
  highlightedCommentId,
  onHighlightClick,
}: HighlightedTextProps): React.ReactElement {
  const textEnd = contentStartIndex + text.length;
  const relevantRegions = regions.filter(
    (r) => r.start < textEnd && r.end > contentStartIndex
  );

  if (relevantRegions.length === 0) {
    return <>{text}</>;
  }

  const segments: React.ReactNode[] = [];
  let currentPos = 0;

  relevantRegions.forEach((region, index) => {
    const localStart = Math.max(0, region.start - contentStartIndex);
    const localEnd = Math.min(text.length, region.end - contentStartIndex);

    if (localStart > currentPos) {
      segments.push(text.slice(currentPos, localStart));
    }

    const isHighlighted = region.commentId === highlightedCommentId;
    segments.push(
      <span
        key={`hl-${index}`}
        data-comment-interactive
        className={`${styles.commentHighlight} ${isHighlighted ? styles.commentHighlightActive : ''}`}
        data-comment-id={region.commentId}
        onClick={(e) => {
          e.stopPropagation();
          onHighlightClick(region.commentId);
        }}
      >
        {text.slice(localStart, localEnd)}
      </span>
    );

    currentPos = localEnd;
  });

  if (currentPos < text.length) {
    segments.push(text.slice(currentPos));
  }

  return <>{segments}</>;
}

export default function MarkdownViewer({
  content,
  regions,
  highlightedCommentId,
  pendingRegion,
  onTextSelect,
  onHighlightClick,
  onSelectionMade,
  containerRef,
}: MarkdownViewerProps) {
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

    // Find position in stripped content
    const startIndex = content.indexOf(selectedText);
    if (startIndex === -1) return;
    const endIndex = startIndex + selectedText.length;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef?.current?.getBoundingClientRect();
    const scrollTop = containerRef?.current?.scrollTop ?? 0;
    const selectionTop = containerRect ? rect.top - containerRect.top + scrollTop : 0;

    onSelectionMade?.();
    onTextSelect({ startIndex, endIndex, selectionTop });
  }, [content, onTextSelect, onSelectionMade, containerRef]);

  const highlightRegions = useMemo((): HighlightRegion[] => {
    const result: HighlightRegion[] = regions.map(r => ({
      start: r.start,
      end: r.end,
      commentId: r.commentId,
    }));

    // Add pending selection
    if (pendingRegion) {
      result.push({
        start: pendingRegion.start,
        end: pendingRegion.end,
        commentId: '__pending__',
      });
    }

    return result.sort((a, b) => a.start - b.start);
  }, [regions, pendingRegion]);

  const components = useMemo(() => {
    function renderWithHighlights(text: string): React.ReactNode {
      const textStart = content.indexOf(text);
      if (textStart === -1) {
        return text;
      }
      return (
        <HighlightedText
          text={text}
          regions={highlightRegions}
          contentStartIndex={textStart}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
        />
      );
    }

    function processChildren(children: React.ReactNode): React.ReactNode {
      if (typeof children === 'string') {
        return renderWithHighlights(children);
      }
      if (Array.isArray(children)) {
        return children.map((child, index) => {
          if (typeof child === 'string') {
            return <React.Fragment key={index}>{renderWithHighlights(child)}</React.Fragment>;
          }
          return child;
        });
      }
      return children;
    }

    return {
      p: ({ children }: { children?: React.ReactNode }) => {
        return <p>{processChildren(children)}</p>;
      },
    };
  }, [content, highlightRegions, highlightedCommentId, onHighlightClick]);

  return (
    <div ref={containerRef} className={styles.container} onMouseUp={handleMouseUp}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
