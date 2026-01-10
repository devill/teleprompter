'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createMatcherState,
  processSpokenWord,
  searchForJumpTarget,
  applyJump,
  jumpBackBlocks,
  jumpForwardBlocks,
  jumpToSectionStart,
  jumpToPreviousSection,
  jumpToNextSection,
  getCurrentSectionBounds,
  type MatchResult,
  type MatcherState,
  type JumpSearchResult,
  type DocumentWord,
} from '@/app/lib/speechMatcher';
import { normalizeNumber } from '@/app/lib/textNormalizer';
import type { SectionAnchor } from '@/app/lib/sectionParser';

const JUMP_BASE_TRIGGER = ['please', 'jump'];
const JUMP_PAUSE_MS = 800;
const JUMP_MAX_WAIT_MS = 5000; // Cancel listening mode if no target words arrive
const LOOP_SILENCE_MS = 1000; // Trigger loop after silence when prompter is behind
const LOOP_END_THRESHOLD = 3; // Within 3 words of section end triggers silence check

function parseSpokenNumber(word: string): number | null {
  const direct = parseInt(word, 10);
  if (!isNaN(direct)) return direct;

  const normalized = normalizeNumber(word);
  const parsed = parseInt(normalized, 10);
  if (!isNaN(parsed)) return parsed;

  return null;
}

type JumpCommandType =
  | { type: 'search'; targetWords: string[] }
  | { type: 'search-incomplete' }
  | { type: 'back'; count: number }
  | { type: 'back-incomplete' }
  | { type: 'forward'; count: number }
  | { type: 'forward-incomplete' }
  | { type: 'section-start' }
  | { type: 'previous-section' }
  | { type: 'next-section' }
  | { type: 'incomplete' };

function parseJumpCommand(wordsAfterBaseTrigger: string[]): JumpCommandType {
  if (wordsAfterBaseTrigger.length === 0) {
    return { type: 'incomplete' };
  }

  const firstWord = wordsAfterBaseTrigger[0];

  // Handle variations: "back", "backwards"
  if (firstWord === 'back' || firstWord === 'backwards') {
    if (wordsAfterBaseTrigger.length < 2) {
      return { type: 'back-incomplete' };
    }
    const count = parseSpokenNumber(wordsAfterBaseTrigger[1]);
    if (count !== null) {
      return { type: 'back', count };
    }
    return { type: 'back-incomplete' };
  }

  // Handle variations: "forward", "forwards"
  if (firstWord === 'forward' || firstWord === 'forwards') {
    if (wordsAfterBaseTrigger.length < 2) {
      return { type: 'forward-incomplete' };
    }
    const count = parseSpokenNumber(wordsAfterBaseTrigger[1]);
    if (count !== null) {
      return { type: 'forward', count };
    }
    return { type: 'forward-incomplete' };
  }

  if (firstWord === 'to') {
    if (wordsAfterBaseTrigger.length < 2) {
      return { type: 'search-incomplete' };
    }

    const secondWord = wordsAfterBaseTrigger[1];

    if (secondWord === 'section' && wordsAfterBaseTrigger.length >= 3) {
      const thirdWord = wordsAfterBaseTrigger[2];
      if (thirdWord === 'start') {
        return { type: 'section-start' };
      }
    }

    if (secondWord === 'previous' && wordsAfterBaseTrigger.length >= 3) {
      const thirdWord = wordsAfterBaseTrigger[2];
      if (thirdWord === 'section') {
        return { type: 'previous-section' };
      }
    }

    if (secondWord === 'next' && wordsAfterBaseTrigger.length >= 3) {
      const thirdWord = wordsAfterBaseTrigger[2];
      if (thirdWord === 'section') {
        return { type: 'next-section' };
      }
    }

    const targetWords = wordsAfterBaseTrigger.slice(1);
    return { type: 'search', targetWords };
  }

  return { type: 'incomplete' };
}

interface UseTextMatcherProps {
  content: string;
  sectionAnchors: SectionAnchor[];
  isListening: boolean;
  isLoopMode?: boolean;
  onMatch?: (result: MatchResult) => void;
  onCommand?: (commandText: string) => void;
}

export type JumpModeStatus = 'inactive' | 'listening' | 'searching' | 'success' | 'no-match';

interface UseTextMatcherReturn {
  processTranscript: (transcript: string) => void;
  currentWordIndex: number;
  currentLineIndex: number;
  resetPosition: () => void;
  setPosition: (wordIndex: number) => void;
  jumpModeStatus: JumpModeStatus;
  jumpTargetText: string;
  words: DocumentWord[];
}

export function useTextMatcher({
  content,
  sectionAnchors,
  isListening,
  isLoopMode = false,
  onMatch,
  onCommand,
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
  const pendingCommandTypeRef = useRef<'back' | 'forward' | null>(null);
  const wasListeningRef = useRef(false);
  const loopSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopSectionBoundsRef = useRef<{ startWordIndex: number; endWordIndex: number } | null>(null);

  // Recreate matcher state when content changes
  useEffect(() => {
    const newState = createMatcherState(content, sectionAnchors);
    setMatcherState(newState);
    setCurrentLineIndex(0);
    lastProcessedCountRef.current = 0;
    lastTriggerWordCountRef.current = 0;
    jumpModeWordsRef.current = [];
    pendingCommandTypeRef.current = null;
    setJumpModeStatus('inactive');
    setJumpTargetText('');
  }, [content, sectionAnchors]);

  // Reset transcript processing counters when listening starts
  useEffect(() => {
    if (isListening && !wasListeningRef.current) {
      lastProcessedCountRef.current = 0;
      lastTriggerWordCountRef.current = 0;
    }
    wasListeningRef.current = isListening;
  }, [isListening]);

  // Set up loop section bounds when loop mode enabled, clear when disabled
  useEffect(() => {
    if (isLoopMode && isListening) {
      // Initialize loop bounds to current section when loop mode is enabled
      if (!loopSectionBoundsRef.current) {
        const bounds = getCurrentSectionBounds(matcherState);
        loopSectionBoundsRef.current = bounds;
      }
    } else {
      // Clear loop state when loop mode disabled or not listening
      loopSectionBoundsRef.current = null;
      if (loopSilenceTimerRef.current) {
        clearTimeout(loopSilenceTimerRef.current);
        loopSilenceTimerRef.current = null;
      }
    }
  }, [isLoopMode, isListening, matcherState]);

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
      onMatch?.(matchResult);
      onCommand?.(`please jump to ${targetWords.join(' ')}`);

      // Update loop bounds if loop mode is active (jumping changes the loop section)
      if (isLoopMode) {
        const newBounds = getCurrentSectionBounds(newState);
        loopSectionBoundsRef.current = newBounds;
      }
    } else {
      setJumpModeStatus('no-match');
      setJumpTargetText(targetWords.join(' '));
    }

    jumpModeWordsRef.current = [];
  }, [matcherState, onMatch, onCommand, isLoopMode]);

  const executeDirectJump = useCallback((jumpFn: () => JumpSearchResult | null, commandName: string) => {
    setJumpModeStatus('searching');
    const result = jumpFn();

    if (result) {
      const { result: matchResult, newState } = applyJump(result, matcherState);
      setMatcherState(newState);
      setCurrentLineIndex(matchResult.lineIndex);
      setJumpModeStatus('success');
      setJumpTargetText(result.matchedText);
      onMatch?.(matchResult);
      onCommand?.(`please jump ${commandName}`);

      // Update loop bounds if loop mode is active (jumping changes the loop section)
      if (isLoopMode) {
        const newBounds = getCurrentSectionBounds(newState);
        loopSectionBoundsRef.current = newBounds;
      }
    } else {
      setJumpModeStatus('no-match');
      setJumpTargetText(commandName);
    }

    jumpModeWordsRef.current = [];
  }, [matcherState, onMatch, onCommand, isLoopMode]);

  const processTranscript = useCallback((transcript: string) => {
    const words = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Find new words since last processing
    const lastProcessedCount = lastProcessedCountRef.current;
    if (wordCount <= lastProcessedCount) return;

    const newWords = words.slice(lastProcessedCount);
    lastProcessedCountRef.current = wordCount;

    // If in listening mode, accumulate words for jump target search
    if (jumpModeStatus === 'listening') {
      // Check if we're waiting for a number argument (back/forward incomplete)
      if (pendingCommandTypeRef.current !== null) {
        // Try to parse the first new word as a number
        const firstWord = newWords[0];
        const count = parseSpokenNumber(firstWord);

        if (count !== null) {
          // Clear timers
          if (jumpMaxWaitTimerRef.current) {
            clearTimeout(jumpMaxWaitTimerRef.current);
            jumpMaxWaitTimerRef.current = null;
          }
          if (jumpPauseTimerRef.current) {
            clearTimeout(jumpPauseTimerRef.current);
            jumpPauseTimerRef.current = null;
          }

          // Execute the command
          const commandType = pendingCommandTypeRef.current;
          pendingCommandTypeRef.current = null;
          jumpModeWordsRef.current = [];

          if (commandType === 'back') {
            executeDirectJump(() => jumpBackBlocks(count, matcherState), `back ${count}`);
          } else {
            executeDirectJump(() => jumpForwardBlocks(count, matcherState), `forward ${count}`);
          }
          return;
        }

        // Not a number - update display but keep waiting
        jumpModeWordsRef.current = [...jumpModeWordsRef.current, ...newWords];
        setJumpTargetText(`${pendingCommandTypeRef.current} ${jumpModeWordsRef.current.join(' ')}`);
      } else {
        // Normal search mode - accumulate words
        jumpModeWordsRef.current = [...jumpModeWordsRef.current, ...newWords];
        setJumpTargetText(jumpModeWordsRef.current.join(' '));
      }

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
        // If we were waiting for a number and didn't get one, cancel
        if (pendingCommandTypeRef.current !== null) {
          pendingCommandTypeRef.current = null;
          jumpModeWordsRef.current = [];
          setJumpModeStatus('inactive');
          setJumpTargetText('');
          return;
        }

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
      // Look for trigger in the tail of all words (last 10 words to allow for command parsing)
      const searchStart = Math.max(0, wordCount - 10);
      const searchWords = words.slice(searchStart);
      const triggerIndex = findTriggerPhrase(searchWords, JUMP_BASE_TRIGGER);

      if (triggerIndex >= 0) {
        // Calculate absolute position of base trigger end
        const absoluteTriggerEnd = searchStart + triggerIndex + JUMP_BASE_TRIGGER.length;

        // Only trigger if this is a NEW trigger (not one we've seen before)
        if (absoluteTriggerEnd > lastTriggerWordCountRef.current) {
          const wordsAfterBaseTrigger = words.slice(absoluteTriggerEnd);
          const command = parseJumpCommand(wordsAfterBaseTrigger);

          // Handle complete commands immediately
          if (command.type === 'section-start') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpToSectionStart(matcherState), 'section start');
            return;
          }

          if (command.type === 'previous-section') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpToPreviousSection(matcherState), 'previous section');
            return;
          }

          if (command.type === 'next-section') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpToNextSection(matcherState), 'next section');
            return;
          }

          if (command.type === 'back') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpBackBlocks(command.count, matcherState), `back ${command.count}`);
            return;
          }

          if (command.type === 'forward') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpForwardBlocks(command.count, matcherState), `forward ${command.count}`);
            return;
          }

          if (command.type === 'search') {
            lastTriggerWordCountRef.current = wordCount;
            setJumpModeStatus('listening');
            jumpModeWordsRef.current = command.targetWords;
            setJumpTargetText(command.targetWords.join(' '));

            // Start pause timer for search
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

          // Incomplete commands - enter listening mode
          if (command.type === 'search-incomplete') {
            lastTriggerWordCountRef.current = wordCount;
            setJumpModeStatus('listening');
            jumpModeWordsRef.current = [];
            pendingCommandTypeRef.current = null;
            setJumpTargetText('');

            // Start max wait timer - cancel listening if no words arrive
            if (jumpMaxWaitTimerRef.current) {
              clearTimeout(jumpMaxWaitTimerRef.current);
            }
            jumpMaxWaitTimerRef.current = setTimeout(() => {
              pendingCommandTypeRef.current = null;
              setJumpModeStatus('inactive');
              setJumpTargetText('');
            }, JUMP_MAX_WAIT_MS);
            return;
          }

          // back-incomplete or forward-incomplete - enter listening mode waiting for number
          if (command.type === 'back-incomplete' || command.type === 'forward-incomplete') {
            lastTriggerWordCountRef.current = wordCount;
            setJumpModeStatus('listening');
            jumpModeWordsRef.current = [];
            pendingCommandTypeRef.current = command.type === 'back-incomplete' ? 'back' : 'forward';
            setJumpTargetText(`${pendingCommandTypeRef.current} ...`);

            // Start max wait timer - cancel listening if no number arrives
            if (jumpMaxWaitTimerRef.current) {
              clearTimeout(jumpMaxWaitTimerRef.current);
            }
            jumpMaxWaitTimerRef.current = setTimeout(() => {
              pendingCommandTypeRef.current = null;
              setJumpModeStatus('inactive');
              setJumpTargetText('');
            }, JUMP_MAX_WAIT_MS);
            return;
          }

          // For 'incomplete' (just "please jump" with nothing after) - wait for more words
          // Don't update lastTriggerWordCountRef so we can re-parse when more words arrive
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
        onMatch?.(result);
      }
    }

    // Loop mode: check if we've gone past the loop section's end
    const loopBounds = loopSectionBoundsRef.current;
    if (isLoopMode && jumpModeStatus === 'inactive' && loopBounds) {
      const currentPos = currentState.currentWordIndex;

      // If we've gone past the loop section's end, immediately jump back
      if (currentPos > loopBounds.endWordIndex) {
        // Clear any pending timer
        if (loopSilenceTimerRef.current) {
          clearTimeout(loopSilenceTimerRef.current);
          loopSilenceTimerRef.current = null;
        }

        // Jump back to the loop section's start
        const jumpResult: JumpSearchResult = {
          lineIndex: currentState.words[loopBounds.startWordIndex]?.lineIndex ?? 0,
          globalWordIndex: loopBounds.startWordIndex,
          score: 100,
          matchedText: 'loop',
        };
        const { result: matchResult, newState } = applyJump(jumpResult, currentState);
        setMatcherState(newState);
        setCurrentLineIndex(matchResult.lineIndex);
        onMatch?.(matchResult);
        return;
      }

      // If within threshold of end, start silence timer (for when prompter is behind)
      const wordsFromEnd = loopBounds.endWordIndex - currentPos;
      if (wordsFromEnd <= LOOP_END_THRESHOLD && wordsFromEnd >= 0) {
        // Near end - start/restart silence timer as backup
        if (loopSilenceTimerRef.current) {
          clearTimeout(loopSilenceTimerRef.current);
        }
        loopSilenceTimerRef.current = setTimeout(() => {
          // Jump back to loop section start
          const startWord = matcherState.words[loopBounds.startWordIndex];
          if (startWord) {
            const jumpResult: JumpSearchResult = {
              lineIndex: startWord.lineIndex,
              globalWordIndex: loopBounds.startWordIndex,
              score: 100,
              matchedText: 'loop',
            };
            const { result: matchResult, newState } = applyJump(jumpResult, matcherState);
            setMatcherState(newState);
            setCurrentLineIndex(matchResult.lineIndex);
            onMatch?.(matchResult);
          }
          loopSilenceTimerRef.current = null;
        }, LOOP_SILENCE_MS);
      } else if (wordsFromEnd > LOOP_END_THRESHOLD) {
        // Not near end - clear any pending timer
        if (loopSilenceTimerRef.current) {
          clearTimeout(loopSilenceTimerRef.current);
          loopSilenceTimerRef.current = null;
        }
      }
    }

    setMatcherState(currentState);
  }, [matcherState, onMatch, onCommand, jumpModeStatus, executeJumpSearch, executeDirectJump, isLoopMode]);

  const resetPosition = useCallback(() => {
    setMatcherState(createMatcherState(content, sectionAnchors));
    setCurrentLineIndex(0);
    lastProcessedCountRef.current = 0;
    lastTriggerWordCountRef.current = 0;
    jumpModeWordsRef.current = [];
    pendingCommandTypeRef.current = null;
    setJumpModeStatus('inactive');
    setJumpTargetText('');
    loopSectionBoundsRef.current = null;
    if (loopSilenceTimerRef.current) {
      clearTimeout(loopSilenceTimerRef.current);
      loopSilenceTimerRef.current = null;
    }
  }, [content, sectionAnchors]);

  const setPosition = useCallback((wordIndex: number) => {
    const wordsCount = matcherState.words.length;

    // Handle empty words array
    if (wordsCount === 0) {
      return;
    }

    // Clamp wordIndex to valid range
    const clampedIndex = Math.max(0, Math.min(wordIndex, wordsCount - 1));

    // Look up lineIndex from the words array
    const lineIndex = matcherState.words[clampedIndex].lineIndex;

    // Update matcher state with new word index
    setMatcherState(prevState => ({
      ...prevState,
      currentWordIndex: clampedIndex,
    }));

    // Update line index
    setCurrentLineIndex(lineIndex);

    // Reset transcript processing counter
    lastProcessedCountRef.current = 0;

    // Cancel jump mode if active
    if (jumpModeStatus !== 'inactive') {
      jumpModeWordsRef.current = [];
      pendingCommandTypeRef.current = null;
      setJumpModeStatus('inactive');
      setJumpTargetText('');

      // Clear any pending timers
      if (jumpPauseTimerRef.current) {
        clearTimeout(jumpPauseTimerRef.current);
        jumpPauseTimerRef.current = null;
      }
      if (jumpMaxWaitTimerRef.current) {
        clearTimeout(jumpMaxWaitTimerRef.current);
        jumpMaxWaitTimerRef.current = null;
      }
    }
  }, [matcherState.words, jumpModeStatus]);

  return {
    processTranscript,
    currentWordIndex: matcherState.currentWordIndex,
    currentLineIndex,
    resetPosition,
    setPosition,
    jumpModeStatus,
    jumpTargetText,
    words: matcherState.words,
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
