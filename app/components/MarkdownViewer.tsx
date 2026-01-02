'use client';

import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './MarkdownViewer.module.css';

interface TextSelectionData {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  anchor: TextSelectionData;
  createdAt: string;
}

interface MarkdownViewerProps {
  content: string;
  comments: Comment[];
  highlightedCommentId: string | null;
  onTextSelect: (data: TextSelectionData) => void;
  onHighlightClick: (commentId: string) => void;
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
        className={`${styles.commentHighlight} ${isHighlighted ? styles.commentHighlightActive : ''}`}
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
  comments,
  highlightedCommentId,
  onTextSelect,
  onHighlightClick,
}: MarkdownViewerProps) {
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

    onTextSelect({
      selectedText,
      contextBefore,
      contextAfter,
    });
  }, [content, onTextSelect]);

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
    <div className={styles.container} onMouseUp={handleMouseUp}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
