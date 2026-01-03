import { describe, it, expect } from 'vitest';
import {
  createMatcherState,
  processSpokenWord,
  checkSectionJump,
  matchSpokenText,
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
    expect(state.lostCounter).toBe(0);
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

  it('increments lost counter when no match found', () => {
    const state = createTestState('The quick brown fox');
    const { result, newState } = processSpokenWord('elephant', state);

    expect(result).toBeNull();
    expect(newState.lostCounter).toBe(1);
    expect(newState.currentWordIndex).toBe(0); // Didn't move
  });

  it('resets lost counter on match', () => {
    let state = createTestState('The quick brown fox');
    state = { ...state, lostCounter: 5 };

    const { newState } = processSpokenWord('the', state);

    expect(newState.lostCounter).toBe(0);
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

describe('checkSectionJump', () => {
  it('does not jump if not lost for long enough', () => {
    const anchors: SectionAnchor[] = [
      {
        id: 'lesson-5',
        type: 'numbered',
        level: 0,
        text: 'Lesson 5',
        normalizedText: 'lesson 5',
        keywords: ['lesson', '5', 'five', 'number'],
        charIndex: 0,
      },
    ];
    let state = createMatcherState('Some text', anchors);
    state = { ...state, lostCounter: 2 }; // Below threshold (threshold is 5)

    const { result } = checkSectionJump(['lesson', 'five'], state);

    expect(result).toBeNull();
  });

  it('jumps to section when lost and keywords match', () => {
    const anchors: SectionAnchor[] = [
      {
        id: 'lesson-5',
        type: 'numbered',
        level: 0,
        text: 'Lesson 5',
        normalizedText: 'lesson 5',
        keywords: ['lesson', '5', 'five', 'number'],
        charIndex: 0,
      },
    ];
    let state = createMatcherState('Some text here', anchors);
    state = { ...state, lostCounter: 20 }; // Above threshold

    const { result } = checkSectionJump(['lesson', 'five'], state);

    expect(result).not.toBeNull();
    expect(result!.matchType).toBe('section_jump');
  });

  it('requires 2+ keywords to trigger jump', () => {
    const anchors: SectionAnchor[] = [
      {
        id: 'lesson-5',
        type: 'numbered',
        level: 0,
        text: 'Lesson 5',
        normalizedText: 'lesson 5',
        keywords: ['lesson', '5', 'five', 'number'],
        charIndex: 0,
      },
    ];
    let state = createMatcherState('Some text', anchors);
    state = { ...state, lostCounter: 20 };

    // Only one keyword matches
    const { result } = checkSectionJump(['lesson', 'random'], state);

    expect(result).toBeNull();
  });

  it('picks best matching anchor when multiple have same common keywords', () => {
    // This tests "lesson number two" - all lessons match "lesson" and "number",
    // but Lesson 2 also matches "two" for a higher score
    const anchors: SectionAnchor[] = [
      {
        id: 'lesson-1',
        type: 'numbered',
        level: 0,
        text: 'Lesson 1',
        normalizedText: 'lesson 1',
        keywords: ['lesson', '1', 'one', 'number'],
        charIndex: 0,
      },
      {
        id: 'lesson-2',
        type: 'numbered',
        level: 0,
        text: 'Lesson 2',
        normalizedText: 'lesson 2',
        keywords: ['lesson', '2', 'two', 'number'],
        charIndex: 50,
      },
      {
        id: 'lesson-3',
        type: 'numbered',
        level: 0,
        text: 'Lesson 3',
        normalizedText: 'lesson 3',
        keywords: ['lesson', '3', 'three', 'number'],
        charIndex: 100,
      },
    ];
    // Content with all three lessons
    const content = 'Lesson 1 content here\nLesson 2 content here\nLesson 3 content here';
    let state = createMatcherState(content, anchors);
    state = { ...state, lostCounter: 20 };

    // Say "lesson number two" - should match Lesson 2 with highest score
    const { result } = checkSectionJump(['lesson', 'number', 'two'], state);

    expect(result).not.toBeNull();
    expect(result!.matchType).toBe('section_jump');
    expect(result!.lineIndex).toBe(1); // Lesson 2 is on line index 1
  });
});

describe('matchSpokenText (legacy API)', () => {
  it('returns null for empty spoken words', () => {
    const state = createMatcherState('Hello world', []);
    const result = matchSpokenText([], state);

    expect(result).toBeNull();
  });

  it('returns null for empty document', () => {
    const state = createMatcherState('', []);
    const result = matchSpokenText(['hello'], state);

    expect(result).toBeNull();
  });

  it('processes last word and returns match', () => {
    const state = createMatcherState('The quick brown fox', []);
    const result = matchSpokenText(['some', 'words', 'the'], state);

    expect(result).not.toBeNull();
    expect(result!.matchType).toBe('advance');
  });
});
