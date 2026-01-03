'use client';

import { forwardRef, useMemo } from 'react';
import styles from './TeleprompterView.module.css';

interface TeleprompterViewProps {
  content: string;
  fontSize: number;
  marginPercentage: number;
  currentLineIndex?: number;
  currentWordIndex?: number;  // Global word index for dimming spoken words
}

function stripMarkdown(text: string): string {
  return text
    // Remove headers (### Header -> Header)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove blockquote markers
    .replace(/^>\s*/gm, '')
    // Clean up extra whitespace
    .trim();
}

interface LineData {
  text: string;
  words: string[];
  startWordIndex: number;  // Global word index where this line starts
}

const TeleprompterView = forwardRef<HTMLDivElement, TeleprompterViewProps>(
  function TeleprompterView({ content, fontSize, marginPercentage, currentLineIndex, currentWordIndex = 0 }, ref) {
    // Parse lines and track word indices
    const lineData = useMemo(() => {
      const result: LineData[] = [];
      let globalWordIndex = 0;

      const lines = content.split('\n')
        .map(line => stripMarkdown(line))
        .filter(line => line.trim());

      for (const text of lines) {
        const words = text.split(/\s+/).filter(w => w);
        result.push({
          text,
          words,
          startWordIndex: globalWordIndex,
        });
        globalWordIndex += words.length;
      }

      return result;
    }, [content]);

    const containerStyle = {
      '--teleprompter-font-size': `${fontSize}px`,
      '--teleprompter-margin': `${marginPercentage}%`,
    } as React.CSSProperties;

    return (
      <div className={styles.container} style={containerStyle} ref={ref}>
        <div className={styles.content}>
          {lineData.map((line, lineIndex) => (
            <p
              key={lineIndex}
              className={`${styles.line} ${lineIndex === currentLineIndex ? styles.currentLine : ''}`}
              data-line-index={lineIndex}
            >
              {line.words.map((word, wordIdx) => {
                const globalIdx = line.startWordIndex + wordIdx;
                const isSpoken = globalIdx < currentWordIndex;
                return (
                  <span
                    key={wordIdx}
                    className={isSpoken ? styles.spokenWord : styles.unspokenWord}
                  >
                    {word}
                    {wordIdx < line.words.length - 1 ? ' ' : ''}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
      </div>
    );
  }
);

export default TeleprompterView;
