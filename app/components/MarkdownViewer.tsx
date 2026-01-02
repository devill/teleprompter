'use client';

import { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './MarkdownViewer.module.css';

interface TextSelectionData {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
}

interface MarkdownViewerProps {
  content: string;
  onTextSelect: (data: TextSelectionData) => void;
}

export default function MarkdownViewer({ content, onTextSelect }: MarkdownViewerProps) {
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

  return (
    <div className={styles.container} onMouseUp={handleMouseUp}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
