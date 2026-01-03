'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createMatcherState,
  processSpokenWord,
  searchForJumpTarget,
  applyJump,
  type MatchResult,
  type MatcherState,
} from '@/app/lib/speechMatcher';
import type { SectionAnchor } from '@/app/lib/sectionParser';

const JUMP_TRIGGER = ['please', 'jump', 'to'];
const JUMP_PAUSE_MS = 800;
const JUMP_MAX_WAIT_MS = 5000; // Cancel listening mode if no target words arrive

interface UseTextMatcherProps {
  content: string;
  sectionAnchors: SectionAnchor[];
  onMatch: (result: MatchResult) => void;
}

export type JumpModeStatus = 'inactive' | 'listening' | 'searching' | 'success' | 'no-match';

interface UseTextMatcherReturn {
  processTranscript: (transcript: string) => void;
  currentWordIndex: number;
  currentLineIndex: number;
  resetPosition: () => void;
  jumpModeStatus: JumpModeStatus;
  jumpTargetText: string;
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
  const [jumpModeStatus, setJumpModeStatus] = useState<JumpModeStatus>('inactive');
  const [jumpTargetText, setJumpTargetText] = useState('');

  const lastProcessedCountRef = useRef<number>(0);
  const lastTriggerWordCountRef = useRef<number>(0);
  const jumpModeWordsRef = useRef<string[]>([]);
  const jumpPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpMaxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recreate matcher state when content changes
  useEffect(() => {
    const newState = createMatcherState(content, sectionAnchors);
    setMatcherState(newState);
    setCurrentLineIndex(0);
    lastProcessedCountRef.current = 0;
    lastTriggerWordCountRef.current = 0;
    jumpModeWordsRef.current = [];
    setJumpModeStatus('inactive');
    setJumpTargetText('');
  }, [content, sectionAnchors]);

  // Clear success/no-match status after a delay
  useEffect(() => {
    if (jumpModeStatus === 'success' || jumpModeStatus === 'no-match') {
      const timer = setTimeout(() => {
        setJumpModeStatus('inactive');
        setJumpTargetText('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [jumpModeStatus]);

  const executeJumpSearch = useCallback((targetWords: string[]) => {
    setJumpModeStatus('searching');

    const result = searchForJumpTarget(targetWords, matcherState);

    if (result) {
      const { result: matchResult, newState } = applyJump(result, matcherState);
      setMatcherState(newState);
      setCurrentLineIndex(matchResult.lineIndex);
      setJumpModeStatus('success');
      setJumpTargetText(result.matchedText);
      onMatch(matchResult);
    } else {
      setJumpModeStatus('no-match');
      setJumpTargetText(targetWords.join(' '));
    }

    jumpModeWordsRef.current = [];
  }, [matcherState, onMatch]);

  const processTranscript = useCallback((transcript: string) => {
    const words = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Find new words since last processing
    const lastProcessedCount = lastProcessedCountRef.current;
    if (wordCount <= lastProcessedCount) return;

    const newWords = words.slice(lastProcessedCount);
    lastProcessedCountRef.current = wordCount;

    // If in listening mode, accumulate words for jump target
    if (jumpModeStatus === 'listening') {
      jumpModeWordsRef.current = [...jumpModeWordsRef.current, ...newWords];
      setJumpTargetText(jumpModeWordsRef.current.join(' '));

      // Clear max wait timer since we got words
      if (jumpMaxWaitTimerRef.current) {
        clearTimeout(jumpMaxWaitTimerRef.current);
        jumpMaxWaitTimerRef.current = null;
      }

      // Reset pause timer
      if (jumpPauseTimerRef.current) {
        clearTimeout(jumpPauseTimerRef.current);
      }
      jumpPauseTimerRef.current = setTimeout(() => {
        if (jumpModeWordsRef.current.length > 0) {
          executeJumpSearch(jumpModeWordsRef.current);
        } else {
          setJumpModeStatus('inactive');
        }
      }, JUMP_PAUSE_MS);

      return;
    }

    // Only check for trigger if we're inactive and have enough new words
    // Also ensure we haven't already processed a trigger at this position
    if (jumpModeStatus === 'inactive' && wordCount > lastTriggerWordCountRef.current) {
      // Look for trigger in the tail of all words (last 6 words to allow for some buffer)
      const searchStart = Math.max(0, wordCount - 6);
      const searchWords = words.slice(searchStart);
      const triggerIndex = findTriggerPhrase(searchWords, JUMP_TRIGGER);

      if (triggerIndex >= 0) {
        // Calculate absolute position of trigger
        const absoluteTriggerEnd = searchStart + triggerIndex + JUMP_TRIGGER.length;

        // Only trigger if this is a NEW trigger (not one we've seen before)
        if (absoluteTriggerEnd > lastTriggerWordCountRef.current) {
          lastTriggerWordCountRef.current = wordCount; // Mark as consumed
          setJumpModeStatus('listening');

          // Capture any words after the trigger
          const wordsAfterTrigger = words.slice(absoluteTriggerEnd);
          jumpModeWordsRef.current = wordsAfterTrigger;
          setJumpTargetText(wordsAfterTrigger.join(' '));

          // Only start pause timer if we already have target words
          // Otherwise wait for first target word to arrive
          if (wordsAfterTrigger.length > 0) {
            if (jumpPauseTimerRef.current) {
              clearTimeout(jumpPauseTimerRef.current);
            }
            jumpPauseTimerRef.current = setTimeout(() => {
              if (jumpModeWordsRef.current.length > 0) {
                executeJumpSearch(jumpModeWordsRef.current);
              } else {
                setJumpModeStatus('inactive');
              }
            }, JUMP_PAUSE_MS);
          } else {
            // Start max wait timer - cancel listening if no words arrive
            if (jumpMaxWaitTimerRef.current) {
              clearTimeout(jumpMaxWaitTimerRef.current);
            }
            jumpMaxWaitTimerRef.current = setTimeout(() => {
              setJumpModeStatus('inactive');
              setJumpTargetText('');
            }, JUMP_MAX_WAIT_MS);
          }

          return;
        }
      }
    }

    // Normal word-by-word tracking (not in jump mode)
    let currentState = matcherState;

    for (const word of newWords) {
      const { result, newState } = processSpokenWord(word, currentState);
      currentState = newState;

      if (result) {
        setCurrentLineIndex(result.lineIndex);
        onMatch(result);
      }
    }

    setMatcherState(currentState);
  }, [matcherState, onMatch, jumpModeStatus, executeJumpSearch]);

  const resetPosition = useCallback(() => {
    setMatcherState(createMatcherState(content, sectionAnchors));
    setCurrentLineIndex(0);
    lastProcessedCountRef.current = 0;
    lastTriggerWordCountRef.current = 0;
    jumpModeWordsRef.current = [];
    setJumpModeStatus('inactive');
    setJumpTargetText('');
  }, [content, sectionAnchors]);

  return {
    processTranscript,
    currentWordIndex: matcherState.currentWordIndex,
    currentLineIndex,
    resetPosition,
    jumpModeStatus,
    jumpTargetText,
  };
}

// Find the trigger phrase in words
function findTriggerPhrase(words: string[], trigger: string[]): number {
  for (let i = 0; i <= words.length - trigger.length; i++) {
    let match = true;
    for (let j = 0; j < trigger.length; j++) {
      if (words[i + j] !== trigger[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  return -1;
}
