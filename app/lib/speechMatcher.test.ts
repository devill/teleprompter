import { describe, it, expect } from 'vitest';
import {
  createMatcherState,
  processSpokenWord,
  searchForJumpTarget,
  applyJump,
  type MatcherState,
} from './speechMatcher';
import type { SectionAnchor } from './sectionParser';

describe('createMatcherState', () => {
  it('creates correct structure for empty content', () => {
    const state = createMatcherState('', []);

    expect(state.currentWordIndex).toBe(0);
    expect(state.words).toEqual([]);
    expect(state.lineCount).toBe(0);
    expect(state.sectionAnchors).toEqual([]);
  });

  it('flattens content into words with line references', () => {
    const content = 'First line\nSecond line';
    const state = createMatcherState(content, []);

    expect(state.words.length).toBe(4);
    expect(state.words[0]).toEqual({ word: 'first', lineIndex: 0, wordIndexInLine: 0, globalIndex: 0 });
    expect(state.words[1]).toEqual({ word: 'line', lineIndex: 0, wordIndexInLine: 1, globalIndex: 1 });
    expect(state.words[2]).toEqual({ word: 'second', lineIndex: 1, wordIndexInLine: 0, globalIndex: 2 });
    expect(state.words[3]).toEqual({ word: 'line', lineIndex: 1, wordIndexInLine: 1, globalIndex: 3 });
  });

  it('filters empty lines', () => {
    const content = 'Line one\n\nLine two';
    const state = createMatcherState(content, []);

    expect(state.lineCount).toBe(2);
    expect(state.words.length).toBe(4);
  });

  it('stores section anchors', () => {
    const anchors: SectionAnchor[] = [
      {
        id: 'test-1',
        type: 'heading',
        level: 1,
        text: 'Lesson 1',
        normalizedText: 'lesson 1',
        keywords: ['lesson', '1', 'one'],
        charIndex: 0,
      },
    ];
    const state = createMatcherState('# Lesson 1', anchors);

    expect(state.sectionAnchors).toBe(anchors);
  });
});

describe('processSpokenWord', () => {
  function createTestState(content: string, anchors: SectionAnchor[] = []): MatcherState {
    return createMatcherState(content, anchors);
  }

  it('returns null for empty word', () => {
    const state = createTestState('Hello world');
    const { result, newState } = processSpokenWord('', state);

    expect(result).toBeNull();
    expect(newState.currentWordIndex).toBe(0);
  });

  it('advances position when word matches next expected word', () => {
    const state = createTestState('The quick brown fox');
    const { result, newState } = processSpokenWord('the', state);

    expect(result).not.toBeNull();
    expect(result!.matchType).toBe('advance');
    expect(result!.globalWordIndex).toBe(0);
    expect(newState.currentWordIndex).toBe(1);
  });

  it('advances to correct position when skipping a word', () => {
    const state = createTestState('The quick brown fox');
    // Say "quick" instead of "the" - should find it in look-ahead
    const { result, newState } = processSpokenWord('quick', state);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1); // "quick" is at index 1
    expect(newState.currentWordIndex).toBe(2);
  });

  it('returns null when no match found in look-ahead', () => {
    const state = createTestState('The quick brown fox');
    const { result, newState } = processSpokenWord('elephant', state);

    expect(result).toBeNull();
    expect(newState.currentWordIndex).toBe(0); // Didn't move
  });

  it('handles number variants (5 matches five)', () => {
    const state = createTestState('Chapter 5 begins');
    const { result } = processSpokenWord('five', state);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1); // "5" is at index 1
  });

  it('handles prefix matches', () => {
    const state = createTestState('The beautiful mountains');
    const { result } = processSpokenWord('beauti', state);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1);
  });

  it('handles fuzzy matches with small edit distance', () => {
    const state = createTestState('The mountains rise');
    // "mountans" is 1 edit away from "mountains"
    const { result } = processSpokenWord('mountans', state);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1);
  });
});

describe('searchForJumpTarget', () => {
  it('returns null for empty target words', () => {
    const state = createMatcherState('Some text here', []);
    const result = searchForJumpTarget([], state);

    expect(result).toBeNull();
  });

  it('returns null for empty document', () => {
    const state = createMatcherState('', []);
    const result = searchForJumpTarget(['lesson', 'one'], state);

    expect(result).toBeNull();
  });

  it('finds matching text in document', () => {
    const content = 'Introduction text\nLesson one content\nConclusion';
    const state = createMatcherState(content, []);
    const result = searchForJumpTarget(['lesson', 'one'], state);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(1);
  });

  it('scores headers higher than regular text', () => {
    const anchors: SectionAnchor[] = [
      {
        id: 'lesson-1',
        type: 'heading',
        level: 2,
        text: 'Lesson 1',
        normalizedText: 'lesson 1',
        keywords: ['lesson', '1', 'one'],
        charIndex: 20,
      },
    ];
    const content = 'Some lesson text\nLesson 1 Header\nMore lesson content';
    const state = createMatcherState(content, anchors);
    const result = searchForJumpTarget(['lesson'], state);

    expect(result).not.toBeNull();
    // Should prefer the header line (line 1) over regular text
    expect(result!.lineIndex).toBe(1);
  });

  it('gives bonus for consecutive word matches', () => {
    const content = 'Lesson two content\nTwo lesson unrelated\nAnother lesson two here';
    const state = createMatcherState(content, []);
    const result = searchForJumpTarget(['lesson', 'two'], state);

    expect(result).not.toBeNull();
    // First line has "lesson two" consecutively
    expect(result!.lineIndex).toBe(0);
  });

  it('handles number word equivalents', () => {
    const content = 'Chapter 1\nChapter 2\nChapter 3';
    const state = createMatcherState(content, []);
    const result = searchForJumpTarget(['chapter', 'two'], state);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(1); // "2" matches "two"
  });
});

describe('applyJump', () => {
  it('updates state to jump position', () => {
    const state = createMatcherState('Line one\nLine two\nLine three', []);
    const jumpResult = {
      lineIndex: 2,
      globalWordIndex: 4,
      score: 100,
      matchedText: 'line three',
    };

    const { result, newState } = applyJump(jumpResult, state);

    expect(result.matchType).toBe('jump');
    expect(result.lineIndex).toBe(2);
    expect(result.globalWordIndex).toBe(4);
    expect(newState.currentWordIndex).toBe(4);
  });
});
