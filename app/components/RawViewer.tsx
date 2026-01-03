'use client';

import { useCallback, useMemo } from 'react';
import styles from './RawViewer.module.css';
import { parseCommentMarkers, StrippedCommentRegion } from '@/app/lib/markerParser';

interface RawViewerProps {
  content: string;  // RAW content WITH markers
  regions: StrippedCommentRegion[];  // Not directly used but kept for interface consistency
  highlightedCommentId: string | null;
  pendingRegion?: { start: number; end: number } | null;
  onTextSelect: (data: { startIndex: number; endIndex: number; selectionTop: number }) => void;
  onHighlightClick: (commentId: string) => void;
  onSelectionMade?: () => void;
  containerRef?: React.RefObject<HTMLPreElement | null>;
}

export default function RawViewer({
  content,
  regions: _regions,
  highlightedCommentId,
  pendingRegion,
  onTextSelect,
  onHighlightClick,
  onSelectionMade,
  containerRef,
}: RawViewerProps) {
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

    // Don't allow selecting marker syntax
    if (selectedText.includes('[[c:') || selectedText.includes('[[/c]]')) return;

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

  const renderContentWithHighlights = useMemo(() => {
    // Parse markers from raw content
    const rawRegions = parseCommentMarkers(content);

    if (rawRegions.length === 0 && !pendingRegion) {
      return content;
    }

    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    // Process each marker region
    rawRegions.forEach((region, index) => {
      // Text before this marker
      if (region.startMarkerIndex > lastEnd) {
        segments.push(content.slice(lastEnd, region.startMarkerIndex));
      }

      const isHighlighted = region.commentId === highlightedCommentId;
      const startMarker = `[[c:${region.commentId}]]`;
      const endMarker = '[[/c]]';

      // Start marker (faded styling)
      segments.push(
        <span key={`marker-start-${index}`} className={styles.marker}>
          {startMarker}
        </span>
      );

      // Highlighted text between markers
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
          {region.selectedText}
        </span>
      );

      // End marker (faded styling)
      segments.push(
        <span key={`marker-end-${index}`} className={styles.marker}>
          {endMarker}
        </span>
      );

      lastEnd = region.endMarkerIndex;
    });

    // Remaining content after last marker
    if (lastEnd < content.length) {
      segments.push(content.slice(lastEnd));
    }

    return segments;
  }, [content, highlightedCommentId, onHighlightClick, pendingRegion]);

  return (
    <pre ref={containerRef} className={styles.container} onMouseUp={handleMouseUp}>
      {renderContentWithHighlights}
    </pre>
  );
}
