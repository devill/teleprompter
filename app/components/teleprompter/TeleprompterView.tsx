'use client';

import { forwardRef, useMemo } from 'react';
import styles from './TeleprompterView.module.css';
import { processBrackets, ProcessedWord } from '@/app/lib/bracketProcessor';

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
  words: ProcessedWord[];
  startWordIndex: number;  // Global word index where this line starts
  isHeader: boolean;       // Whether this line was originally a markdown header
}

const TeleprompterView = forwardRef<HTMLDivElement, TeleprompterViewProps>(
  function TeleprompterView({ content, fontSize, marginPercentage, currentLineIndex, currentWordIndex = 0 }, ref) {
    // Parse lines and track word indices
    const lineData = useMemo(() => {
      const result: LineData[] = [];
      let globalWordIndex = 0;

      const rawLines = content.split('\n').filter(line => line.trim());

      for (const rawLine of rawLines) {
        const isHeader = /^#{1,6}\s+/.test(rawLine);
        const strippedLine = stripMarkdown(rawLine);
        if (!strippedLine) continue;

        // Process brackets on the stripped line
        const [processedLine] = processBrackets(strippedLine);
        if (!processedLine || processedLine.words.length === 0) {
          // Line with only bracket content that was removed
          continue;
        }

        result.push({
          text: processedLine.displayText,
          words: processedLine.words,
          startWordIndex: globalWordIndex,
          isHeader,
        });
        globalWordIndex += processedLine.words.length;
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
              className={`${styles.line} ${lineIndex === currentLineIndex ? styles.currentLine : ''} ${line.isHeader ? styles.headerLine : ''}`}
              data-line-index={lineIndex}
            >
              {line.words.map((wordData, wordIdx) => {
                const globalIdx = line.startWordIndex + wordIdx;
                const isSpoken = globalIdx < currentWordIndex;
                const stateClass = isSpoken ? styles.spokenWord : styles.unspokenWord;
                const directionClass = !wordData.speakable ? styles.stageDirection : '';
                return (
                  <span
                    key={wordIdx}
                    data-word-index={globalIdx}
                    className={`${stateClass} ${directionClass}`}
                  >
                    {wordData.text}
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
