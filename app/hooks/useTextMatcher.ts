'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDocumentState,
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
  type DocumentState,
  type JumpSearchResult,
  type DocumentWord,
} from '@/app/lib/speechMatcher';
import { normalizeNumber } from '@/app/lib/textNormalizer';
import type { SectionAnchor } from '@/app/lib/sectionParser';

const JUMP_BASE_TRIGGER = ['please', 'jump'];
const JUMP_PAUSE_MS = 800;
const JUMP_MAX_WAIT_MS = 5000;
const LOOP_SILENCE_MS = 1000;
const LOOP_END_THRESHOLD = 3;

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

interface SectionBounds {
  startWordIndex: number;
  endWordIndex: number;
}

interface UseTextMatcherProps {
  content: string;
  sectionAnchors: SectionAnchor[];
  isListening: boolean;
  reconnectSuccess?: boolean;
  finalTranscript?: string;
  isLoopMode?: boolean;
  loopSectionBounds: SectionBounds | null;
  wordIndex: number;
  onWordIndexChange: (index: number) => void;
  onLoopBoundsChange: (bounds: SectionBounds | null) => void;
  onMatch?: (result: MatchResult) => void;
  onCommand?: (commandText: string) => void;
}

export type JumpModeStatus = 'inactive' | 'listening' | 'searching' | 'success' | 'no-match';

interface UseTextMatcherReturn {
  processTranscript: (transcript: string) => void;
  lineIndex: number;
  jumpModeStatus: JumpModeStatus;
  jumpTargetText: string;
  words: DocumentWord[];
}

export function useTextMatcher({
  content,
  sectionAnchors,
  isListening,
  reconnectSuccess = false,
  finalTranscript = '',
  isLoopMode = false,
  loopSectionBounds,
  wordIndex,
  onWordIndexChange,
  onLoopBoundsChange,
  onMatch,
  onCommand,
}: UseTextMatcherProps): UseTextMatcherReturn {
  const [documentState, setDocumentState] = useState<DocumentState>(() =>
    createDocumentState(content, sectionAnchors)
  );
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

  // Derive lineIndex from wordIndex and words
  const lineIndex = useMemo(() => {
    if (documentState.words.length === 0) return 0;
    const clampedIndex = Math.min(wordIndex, documentState.words.length - 1);
    return documentState.words[clampedIndex]?.lineIndex ?? 0;
  }, [documentState.words, wordIndex]);

  // Recreate document state when content changes (does NOT reset wordIndex)
  useEffect(() => {
    const newState = createDocumentState(content, sectionAnchors);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Document state must update when content prop changes
    setDocumentState(newState);
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

  // Reset transcript processing counters after reconnection
  // Set to the final transcript's word count (not 0) to avoid reprocessing old words
  // This is needed because the old interim transcript may have inflated lastProcessedCount
  // and the new session's transcript starts fresh with potentially fewer words
  useEffect(() => {
    if (reconnectSuccess) {
      const finalWordCount = finalTranscript.trim()
        ? finalTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 0).length
        : 0;
      lastProcessedCountRef.current = finalWordCount;
      lastTriggerWordCountRef.current = finalWordCount;
    }
  }, [reconnectSuccess, finalTranscript]);

  // Initialize loop bounds when loop mode is enabled and listening starts
  useEffect(() => {
    if (isLoopMode && isListening && !loopSectionBounds) {
      const bounds = getCurrentSectionBounds(documentState, wordIndex);
      onLoopBoundsChange(bounds);
    }
    // Clear silence timer when loop mode is disabled
    if (!isLoopMode || !isListening) {
      if (loopSilenceTimerRef.current) {
        clearTimeout(loopSilenceTimerRef.current);
        loopSilenceTimerRef.current = null;
      }
    }
  }, [isLoopMode, isListening, loopSectionBounds, documentState, wordIndex, onLoopBoundsChange]);

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

    const result = searchForJumpTarget(targetWords, documentState, wordIndex);

    if (result) {
      const { result: matchResult, newWordIndex } = applyJump(result);
      onWordIndexChange(newWordIndex);
      setJumpModeStatus('success');
      setJumpTargetText(result.matchedText);
      onMatch?.(matchResult);
      onCommand?.(`please jump to ${targetWords.join(' ')}`);

      if (isLoopMode) {
        const newBounds = getCurrentSectionBounds(documentState, newWordIndex);
        onLoopBoundsChange(newBounds);
      }
    } else {
      setJumpModeStatus('no-match');
      setJumpTargetText(targetWords.join(' '));
    }

    jumpModeWordsRef.current = [];
  }, [documentState, wordIndex, onWordIndexChange, onMatch, onCommand, isLoopMode, onLoopBoundsChange]);

  const executeDirectJump = useCallback((jumpFn: () => JumpSearchResult | null, commandName: string) => {
    setJumpModeStatus('searching');
    const result = jumpFn();

    if (result) {
      const { result: matchResult, newWordIndex } = applyJump(result);
      onWordIndexChange(newWordIndex);
      setJumpModeStatus('success');
      setJumpTargetText(result.matchedText);
      onMatch?.(matchResult);
      onCommand?.(`please jump ${commandName}`);

      if (isLoopMode) {
        const newBounds = getCurrentSectionBounds(documentState, newWordIndex);
        onLoopBoundsChange(newBounds);
      }
    } else {
      setJumpModeStatus('no-match');
      setJumpTargetText(commandName);
    }

    jumpModeWordsRef.current = [];
  }, [documentState, onWordIndexChange, onMatch, onCommand, isLoopMode, onLoopBoundsChange]);

  const processTranscript = useCallback((transcript: string) => {
    const words = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    const lastProcessedCount = lastProcessedCountRef.current;
    if (wordCount <= lastProcessedCount) return;

    const newWords = words.slice(lastProcessedCount);
    lastProcessedCountRef.current = wordCount;

    // If in listening mode, accumulate words for jump target search
    if (jumpModeStatus === 'listening') {
      if (pendingCommandTypeRef.current !== null) {
        const firstWord = newWords[0];
        const count = parseSpokenNumber(firstWord);

        if (count !== null) {
          if (jumpMaxWaitTimerRef.current) {
            clearTimeout(jumpMaxWaitTimerRef.current);
            jumpMaxWaitTimerRef.current = null;
          }
          if (jumpPauseTimerRef.current) {
            clearTimeout(jumpPauseTimerRef.current);
            jumpPauseTimerRef.current = null;
          }

          const commandType = pendingCommandTypeRef.current;
          pendingCommandTypeRef.current = null;
          jumpModeWordsRef.current = [];

          if (commandType === 'back') {
            executeDirectJump(() => jumpBackBlocks(count, documentState, wordIndex), `back ${count}`);
          } else {
            executeDirectJump(() => jumpForwardBlocks(count, documentState, wordIndex), `forward ${count}`);
          }
          return;
        }

        jumpModeWordsRef.current = [...jumpModeWordsRef.current, ...newWords];
        setJumpTargetText(`${pendingCommandTypeRef.current} ${jumpModeWordsRef.current.join(' ')}`);
      } else {
        jumpModeWordsRef.current = [...jumpModeWordsRef.current, ...newWords];
        setJumpTargetText(jumpModeWordsRef.current.join(' '));
      }

      if (jumpMaxWaitTimerRef.current) {
        clearTimeout(jumpMaxWaitTimerRef.current);
        jumpMaxWaitTimerRef.current = null;
      }

      if (jumpPauseTimerRef.current) {
        clearTimeout(jumpPauseTimerRef.current);
      }
      jumpPauseTimerRef.current = setTimeout(() => {
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
    if (jumpModeStatus === 'inactive' && wordCount > lastTriggerWordCountRef.current) {
      const searchStart = Math.max(0, wordCount - 10);
      const searchWords = words.slice(searchStart);
      const triggerIndex = findTriggerPhrase(searchWords, JUMP_BASE_TRIGGER);

      if (triggerIndex >= 0) {
        const absoluteTriggerEnd = searchStart + triggerIndex + JUMP_BASE_TRIGGER.length;

        if (absoluteTriggerEnd > lastTriggerWordCountRef.current) {
          const wordsAfterBaseTrigger = words.slice(absoluteTriggerEnd);
          const command = parseJumpCommand(wordsAfterBaseTrigger);

          if (command.type === 'section-start') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpToSectionStart(documentState, wordIndex), 'section start');
            return;
          }

          if (command.type === 'previous-section') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpToPreviousSection(documentState, wordIndex), 'previous section');
            return;
          }

          if (command.type === 'next-section') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpToNextSection(documentState, wordIndex), 'next section');
            return;
          }

          if (command.type === 'back') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpBackBlocks(command.count, documentState, wordIndex), `back ${command.count}`);
            return;
          }

          if (command.type === 'forward') {
            lastTriggerWordCountRef.current = wordCount;
            executeDirectJump(() => jumpForwardBlocks(command.count, documentState, wordIndex), `forward ${command.count}`);
            return;
          }

          if (command.type === 'search') {
            lastTriggerWordCountRef.current = wordCount;
            setJumpModeStatus('listening');
            jumpModeWordsRef.current = command.targetWords;
            setJumpTargetText(command.targetWords.join(' '));

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

          if (command.type === 'search-incomplete') {
            lastTriggerWordCountRef.current = wordCount;
            setJumpModeStatus('listening');
            jumpModeWordsRef.current = [];
            pendingCommandTypeRef.current = null;
            setJumpTargetText('');

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

          if (command.type === 'back-incomplete' || command.type === 'forward-incomplete') {
            lastTriggerWordCountRef.current = wordCount;
            setJumpModeStatus('listening');
            jumpModeWordsRef.current = [];
            pendingCommandTypeRef.current = command.type === 'back-incomplete' ? 'back' : 'forward';
            setJumpTargetText(`${pendingCommandTypeRef.current} ...`);

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
        }
      }
    }

    // Normal word-by-word tracking (not in jump mode)
    let currentWordIdx = wordIndex;

    for (const word of newWords) {
      const { result, newWordIndex } = processSpokenWord(word, documentState, currentWordIdx);
      currentWordIdx = newWordIndex;

      if (result) {
        onMatch?.(result);
      }
    }

    // Loop mode: check if we've gone past the loop section's end
    if (isLoopMode && jumpModeStatus === 'inactive' && loopSectionBounds) {
      if (currentWordIdx > loopSectionBounds.endWordIndex) {
        if (loopSilenceTimerRef.current) {
          clearTimeout(loopSilenceTimerRef.current);
          loopSilenceTimerRef.current = null;
        }

        const jumpResult: JumpSearchResult = {
          lineIndex: documentState.words[loopSectionBounds.startWordIndex]?.lineIndex ?? 0,
          globalWordIndex: loopSectionBounds.startWordIndex,
          score: 100,
          matchedText: 'loop',
        };
        const { result: matchResult, newWordIndex } = applyJump(jumpResult);
        onWordIndexChange(newWordIndex);
        onMatch?.(matchResult);
        return;
      }

      const wordsFromEnd = loopSectionBounds.endWordIndex - currentWordIdx;
      if (wordsFromEnd <= LOOP_END_THRESHOLD && wordsFromEnd >= 0) {
        if (loopSilenceTimerRef.current) {
          clearTimeout(loopSilenceTimerRef.current);
        }
        loopSilenceTimerRef.current = setTimeout(() => {
          const startWord = documentState.words[loopSectionBounds.startWordIndex];
          if (startWord) {
            const jumpResult: JumpSearchResult = {
              lineIndex: startWord.lineIndex,
              globalWordIndex: loopSectionBounds.startWordIndex,
              score: 100,
              matchedText: 'loop',
            };
            const { result: matchResult, newWordIndex } = applyJump(jumpResult);
            onWordIndexChange(newWordIndex);
            onMatch?.(matchResult);
          }
          loopSilenceTimerRef.current = null;
        }, LOOP_SILENCE_MS);
      } else if (wordsFromEnd > LOOP_END_THRESHOLD) {
        if (loopSilenceTimerRef.current) {
          clearTimeout(loopSilenceTimerRef.current);
          loopSilenceTimerRef.current = null;
        }
      }
    }

    // Update parent with new word index
    if (currentWordIdx !== wordIndex) {
      onWordIndexChange(currentWordIdx);
    }
  }, [documentState, wordIndex, onWordIndexChange, onMatch, jumpModeStatus, executeJumpSearch, executeDirectJump, isLoopMode, loopSectionBounds]);

  return {
    processTranscript,
    lineIndex,
    jumpModeStatus,
    jumpTargetText,
    words: documentState.words,
  };
}

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
