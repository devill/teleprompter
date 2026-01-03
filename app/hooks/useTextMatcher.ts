'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createMatcherState, processSpokenWord, checkSectionJump, type MatchResult, type MatcherState } from '@/app/lib/speechMatcher';
import type { SectionAnchor } from '@/app/lib/sectionParser';

interface UseTextMatcherProps {
  content: string;
  sectionAnchors: SectionAnchor[];
  onMatch: (result: MatchResult) => void;
}

interface UseTextMatcherReturn {
  processTranscript: (transcript: string) => void;
  currentWordIndex: number;
  currentLineIndex: number;
  resetPosition: () => void;
}

export function useTextMatcher({
  content,
  sectionAnchors,
  onMatch,
}: UseTextMatcherProps): UseTextMatcherReturn {
  const [matcherState, setMatcherState] = useState<MatcherState>(() =>
    createMatcherState(content, sectionAnchors)
  );
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const lastProcessedWordsRef = useRef<string[]>([]);

  // Recreate matcher state when content changes
  useEffect(() => {
    const newState = createMatcherState(content, sectionAnchors);
    setMatcherState(newState);
    setCurrentLineIndex(0);
    lastProcessedWordsRef.current = [];
  }, [content, sectionAnchors]);

  const processTranscript = useCallback((transcript: string) => {
    // Split transcript into words
    const words = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Find new words that haven't been processed yet
    const lastProcessed = lastProcessedWordsRef.current;
    const newWords: string[] = [];

    // Only process genuinely new words at the end
    if (words.length > lastProcessed.length) {
      for (let i = lastProcessed.length; i < words.length; i++) {
        newWords.push(words[i]);
      }
    }

    if (newWords.length === 0) return;

    lastProcessedWordsRef.current = words;

    // Process each new word one by one
    let currentState = matcherState;

    for (const word of newWords) {
      const { result, newState } = processSpokenWord(word, currentState);
      currentState = newState;

      if (result) {
        setCurrentLineIndex(result.lineIndex);
        onMatch(result);
      }
    }

    // Check for section jump if we've been lost for a while
    const recentWords = words.slice(-8);
    const { result: sectionResult, newState: stateAfterSectionCheck } = checkSectionJump(recentWords, currentState);

    if (sectionResult) {
      currentState = stateAfterSectionCheck;
      setCurrentLineIndex(sectionResult.lineIndex);
      onMatch(sectionResult);
    }

    // Update state
    setMatcherState(currentState);
  }, [matcherState, onMatch]);

  const resetPosition = useCallback(() => {
    setMatcherState(createMatcherState(content, sectionAnchors));
    setCurrentLineIndex(0);
    lastProcessedWordsRef.current = [];
  }, [content, sectionAnchors]);

  return {
    processTranscript,
    currentWordIndex: matcherState.currentWordIndex,
    currentLineIndex,
    resetPosition,
  };
}
