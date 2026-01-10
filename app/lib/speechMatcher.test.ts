import { describe, it, expect } from 'vitest';
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

describe('jumpBackBlocks', () => {
  it('returns null when at start of document', () => {
    const state = createMatcherState('Line one\nLine two\nLine three', []);
    // Position is at the beginning (line 0)

    const result = jumpBackBlocks(2, state);

    expect(result).toBeNull();
  });

  it('jumps back correct number of lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createMatcherState(content, []);
    // Move to line 3 (words: zero, one, two, three, four at indices 0-1, 2-3, 4-5, 6-7, 8-9)
    // Line 3 starts at globalIndex 6
    const stateAtLine3: MatcherState = { ...state, currentWordIndex: 6 };

    const result = jumpBackBlocks(2, stateAtLine3);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(1); // Should jump from line 3 to line 1
  });

  it('clamps to beginning if N exceeds available lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createMatcherState(content, []);
    // Move to line 2 (globalIndex 4)
    const stateAtLine2: MatcherState = { ...state, currentWordIndex: 4 };

    const result = jumpBackBlocks(10, stateAtLine2);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(0); // Should clamp to line 0
    expect(result!.globalWordIndex).toBe(0); // First word of line 0
  });
});

describe('jumpForwardBlocks', () => {
  it('returns null when at end of document', () => {
    const content = 'Line one\nLine two\nLine three';
    const state = createMatcherState(content, []);
    // Move to the last line (line 2, which starts at globalIndex 4)
    const stateAtLastLine: MatcherState = { ...state, currentWordIndex: 4 };

    const result = jumpForwardBlocks(2, stateAtLastLine);

    expect(result).toBeNull();
  });

  it('jumps forward correct number of lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createMatcherState(content, []);
    // Start at line 1 (globalIndex 2)
    const stateAtLine1: MatcherState = { ...state, currentWordIndex: 2 };

    const result = jumpForwardBlocks(2, stateAtLine1);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(3); // Should jump from line 1 to line 3
  });

  it('clamps to end if N exceeds available lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createMatcherState(content, []);
    // Start at line 2 (globalIndex 4)
    const stateAtLine2: MatcherState = { ...state, currentWordIndex: 4 };

    const result = jumpForwardBlocks(10, stateAtLine2);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(4); // Should clamp to last line (line 4)
  });
});

describe('jumpToSectionStart', () => {
  // Test content structure:
  // "# Section One\nContent in section one\n\n# Section Two\nContent in section two\n\n# Section Three\nContent in section three"
  // Character indices:
  //   "# Section One" starts at 0
  //   "# Section Two" starts at 38
  //   "# Section Three" starts at 76

  const content = '# Section One\nContent in section one\n\n# Section Two\nContent in section two\n\n# Section Three\nContent in section three';

  const anchors: SectionAnchor[] = [
    { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 0 },
    { id: '2', type: 'heading', level: 1, text: 'Section Two', normalizedText: 'section two', keywords: ['section', 'two'], charIndex: 38 },
    { id: '3', type: 'heading', level: 1, text: 'Section Three', normalizedText: 'section three', keywords: ['section', 'three'], charIndex: 76 },
  ];

  it('returns null with no headings in document', () => {
    const state = createMatcherState('Some plain text without headings', []);

    const result = jumpToSectionStart(state);

    expect(result).toBeNull();
  });

  it('returns the heading that contains the current position', () => {
    const state = createMatcherState(content, anchors);
    // Position in "Content in section two" (line 3, which is after Section Two heading)
    // Words: section(0), one(1), content(2), in(3), section(4), one(5), section(6), two(7), content(8), in(9), section(10), two(11), section(12), three(13), content(14), in(15), section(16), three(17)
    // Line 3 starts at word index 8
    const stateInSectionTwo: MatcherState = { ...state, currentWordIndex: 8 };

    const result = jumpToSectionStart(stateInSectionTwo);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('section two');
  });

  it('returns null when position is before any heading', () => {
    // Create content where headings don't start at position 0
    const contentWithPreamble = 'Preamble text here\n\n# Section One\nContent';
    const anchorsWithPreamble: SectionAnchor[] = [
      { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 20 },
    ];
    const state = createMatcherState(contentWithPreamble, anchorsWithPreamble);
    // Position at word 0 (in preamble, before any heading)

    const result = jumpToSectionStart(state);

    expect(result).toBeNull();
  });

  it('works when already on a heading line', () => {
    const state = createMatcherState(content, anchors);
    // Position at the start of Section Two heading line (word index 6 = "section" from "# Section Two")
    const stateOnHeading: MatcherState = { ...state, currentWordIndex: 6 };

    const result = jumpToSectionStart(stateOnHeading);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('section two');
  });
});

describe('jumpToPreviousSection', () => {
  const content = '# Section One\nContent in section one\n\n# Section Two\nContent in section two\n\n# Section Three\nContent in section three';

  const anchors: SectionAnchor[] = [
    { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 0 },
    { id: '2', type: 'heading', level: 1, text: 'Section Two', normalizedText: 'section two', keywords: ['section', 'two'], charIndex: 38 },
    { id: '3', type: 'heading', level: 1, text: 'Section Three', normalizedText: 'section three', keywords: ['section', 'three'], charIndex: 76 },
  ];

  it('returns null when no previous heading exists (at first heading)', () => {
    const state = createMatcherState(content, anchors);
    // Position at the first section (word index 0)

    const result = jumpToPreviousSection(state);

    expect(result).toBeNull();
  });

  it('returns null when before any heading', () => {
    const contentWithPreamble = 'Preamble text\n\n# Section One\nContent';
    const anchorsWithPreamble: SectionAnchor[] = [
      { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 15 },
    ];
    const state = createMatcherState(contentWithPreamble, anchorsWithPreamble);
    // Position at word 0 (in preamble)

    const result = jumpToPreviousSection(state);

    expect(result).toBeNull();
  });

  it('returns the heading before the current section heading', () => {
    const state = createMatcherState(content, anchors);
    // Position in Section Two (word index 8 = "content" in "Content in section two")
    const stateInSectionTwo: MatcherState = { ...state, currentWordIndex: 8 };

    const result = jumpToPreviousSection(stateInSectionTwo);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('section one');
  });
});

describe('jumpToNextSection', () => {
  const content = '# Section One\nContent in section one\n\n# Section Two\nContent in section two\n\n# Section Three\nContent in section three';

  const anchors: SectionAnchor[] = [
    { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 0 },
    { id: '2', type: 'heading', level: 1, text: 'Section Two', normalizedText: 'section two', keywords: ['section', 'two'], charIndex: 38 },
    { id: '3', type: 'heading', level: 1, text: 'Section Three', normalizedText: 'section three', keywords: ['section', 'three'], charIndex: 76 },
  ];

  it('returns null when no next heading exists (after last heading)', () => {
    const state = createMatcherState(content, anchors);
    // Position in Section Three (word index 14 = "content" in last "Content in section three")
    const stateInSectionThree: MatcherState = { ...state, currentWordIndex: 14 };

    const result = jumpToNextSection(stateInSectionThree);

    expect(result).toBeNull();
  });

  it('returns the first heading after current position', () => {
    const state = createMatcherState(content, anchors);
    // Position in Section One (word index 2 = "content" in first "Content in section one")
    const stateInSectionOne: MatcherState = { ...state, currentWordIndex: 2 };

    const result = jumpToNextSection(stateInSectionOne);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('section two');
  });
});

describe('getCurrentSectionBounds', () => {
  const content = '# Section One\nContent in section one\n\n# Section Two\nContent in section two\n\n# Section Three\nContent in section three';

  const anchors: SectionAnchor[] = [
    { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 0 },
    { id: '2', type: 'heading', level: 1, text: 'Section Two', normalizedText: 'section two', keywords: ['section', 'two'], charIndex: 38 },
    { id: '3', type: 'heading', level: 1, text: 'Section Three', normalizedText: 'section three', keywords: ['section', 'three'], charIndex: 76 },
  ];

  it('returns null for empty document', () => {
    const state = createMatcherState('', []);
    const result = getCurrentSectionBounds(state);
    expect(result).toBeNull();
  });

  it('treats entire document as one section when no headings', () => {
    const state = createMatcherState('Some plain text without headings', []);
    const result = getCurrentSectionBounds(state);

    expect(result).not.toBeNull();
    expect(result!.startWordIndex).toBe(0);
    expect(result!.endWordIndex).toBe(state.words.length - 1);
  });

  it('returns correct bounds for first section', () => {
    const state = createMatcherState(content, anchors);
    // Position in Section One (word index 2 = "content")
    const stateInSectionOne: MatcherState = { ...state, currentWordIndex: 2 };

    const result = getCurrentSectionBounds(stateInSectionOne);

    expect(result).not.toBeNull();
    expect(result!.startWordIndex).toBe(0); // "section" from "# Section One"
    // Section One ends before Section Two starts
    // Section Two is on line 3, so Section One ends at line 2
  });

  it('returns correct bounds for middle section', () => {
    const state = createMatcherState(content, anchors);
    // Position in Section Two (word index 8 = "content" in section two's content)
    const stateInSectionTwo: MatcherState = { ...state, currentWordIndex: 8 };

    const result = getCurrentSectionBounds(stateInSectionTwo);

    expect(result).not.toBeNull();
    // Section Two starts at word 6 ("section" from "# Section Two")
    expect(result!.startWordIndex).toBe(6);
    // Should end before Section Three
  });

  it('returns correct bounds for last section', () => {
    const state = createMatcherState(content, anchors);
    // Position in Section Three (word index 14)
    const stateInSectionThree: MatcherState = { ...state, currentWordIndex: 14 };

    const result = getCurrentSectionBounds(stateInSectionThree);

    expect(result).not.toBeNull();
    // Last section goes to end of document
    expect(result!.endWordIndex).toBe(state.words.length - 1);
  });

  it('handles preamble before first heading', () => {
    const contentWithPreamble = 'Preamble text here\n\n# Section One\nContent';
    const anchorsWithPreamble: SectionAnchor[] = [
      { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 20 },
    ];
    const state = createMatcherState(contentWithPreamble, anchorsWithPreamble);
    // Position at word 0 (in preamble)

    const result = getCurrentSectionBounds(state);

    expect(result).not.toBeNull();
    expect(result!.startWordIndex).toBe(0);
    // Should end before the heading line
  });
});
