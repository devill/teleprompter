import { describe, it, expect } from 'vitest';
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
  type DocumentState,
} from './speechMatcher';
import type { SectionAnchor } from './sectionParser';

describe('createDocumentState', () => {
  it('creates correct structure for empty content', () => {
    const state = createDocumentState('', []);

    expect(state.words).toEqual([]);
    expect(state.lineCount).toBe(0);
    expect(state.sectionAnchors).toEqual([]);
  });

  it('flattens content into words with line references', () => {
    const content = 'First line\nSecond line';
    const state = createDocumentState(content, []);

    expect(state.words.length).toBe(4);
    expect(state.words[0]).toEqual({ word: 'first', lineIndex: 0, wordIndexInLine: 0, globalIndex: 0 });
    expect(state.words[1]).toEqual({ word: 'line', lineIndex: 0, wordIndexInLine: 1, globalIndex: 1 });
    expect(state.words[2]).toEqual({ word: 'second', lineIndex: 1, wordIndexInLine: 0, globalIndex: 2 });
    expect(state.words[3]).toEqual({ word: 'line', lineIndex: 1, wordIndexInLine: 1, globalIndex: 3 });
  });

  it('filters empty lines', () => {
    const content = 'Line one\n\nLine two';
    const state = createDocumentState(content, []);

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
    const state = createDocumentState('# Lesson 1', anchors);

    expect(state.sectionAnchors).toBe(anchors);
  });
});

describe('processSpokenWord', () => {
  function createTestState(content: string, anchors: SectionAnchor[] = []): DocumentState {
    return createDocumentState(content, anchors);
  }

  it('returns null for empty word', () => {
    const state = createTestState('Hello world');
    const { result, newWordIndex } = processSpokenWord('', state, 0);

    expect(result).toBeNull();
    expect(newWordIndex).toBe(0);
  });

  it('advances position when word matches next expected word', () => {
    const state = createTestState('The quick brown fox');
    const { result, newWordIndex } = processSpokenWord('the', state, 0);

    expect(result).not.toBeNull();
    expect(result!.matchType).toBe('advance');
    expect(result!.globalWordIndex).toBe(0);
    expect(newWordIndex).toBe(1);
  });

  it('advances to correct position when skipping a word', () => {
    const state = createTestState('The quick brown fox');
    // Say "quick" instead of "the" - should find it in look-ahead
    const { result, newWordIndex } = processSpokenWord('quick', state, 0);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1); // "quick" is at index 1
    expect(newWordIndex).toBe(2);
  });

  it('returns null when no match found in look-ahead', () => {
    const state = createTestState('The quick brown fox');
    const { result, newWordIndex } = processSpokenWord('elephant', state, 0);

    expect(result).toBeNull();
    expect(newWordIndex).toBe(0); // Didn't move
  });

  it('handles number variants (5 matches five)', () => {
    const state = createTestState('Chapter 5 begins');
    const { result } = processSpokenWord('five', state, 0);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1); // "5" is at index 1
  });

  it('handles prefix matches', () => {
    const state = createTestState('The beautiful mountains');
    const { result } = processSpokenWord('beauti', state, 0);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1);
  });

  it('handles fuzzy matches with small edit distance', () => {
    const state = createTestState('The mountains rise');
    // "mountans" is 1 edit away from "mountains"
    const { result } = processSpokenWord('mountans', state, 0);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(1);
  });
});

describe('searchForJumpTarget', () => {
  it('returns null for empty target words', () => {
    const state = createDocumentState('Some text here', []);
    const result = searchForJumpTarget([], state, 0);

    expect(result).toBeNull();
  });

  it('returns null for empty document', () => {
    const state = createDocumentState('', []);
    const result = searchForJumpTarget(['lesson', 'one'], state, 0);

    expect(result).toBeNull();
  });

  it('finds matching text in document', () => {
    const content = 'Introduction text\nLesson one content\nConclusion';
    const state = createDocumentState(content, []);
    const result = searchForJumpTarget(['lesson', 'one'], state, 0);

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
    const state = createDocumentState(content, anchors);
    const result = searchForJumpTarget(['lesson'], state, 0);

    expect(result).not.toBeNull();
    // Should prefer the header line (line 1) over regular text
    expect(result!.lineIndex).toBe(1);
  });

  it('gives bonus for consecutive word matches', () => {
    const content = 'Lesson two content\nTwo lesson unrelated\nAnother lesson two here';
    const state = createDocumentState(content, []);
    const result = searchForJumpTarget(['lesson', 'two'], state, 0);

    expect(result).not.toBeNull();
    // First line has "lesson two" consecutively
    expect(result!.lineIndex).toBe(0);
  });

  it('handles number word equivalents', () => {
    const content = 'Chapter 1\nChapter 2\nChapter 3';
    const state = createDocumentState(content, []);
    const result = searchForJumpTarget(['chapter', 'two'], state, 0);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(1); // "2" matches "two"
  });
});

describe('applyJump', () => {
  it('returns match result with new position', () => {
    const jumpResult = {
      lineIndex: 2,
      globalWordIndex: 4,
      score: 100,
      matchedText: 'line three',
    };

    const { result, newWordIndex } = applyJump(jumpResult);

    expect(result.matchType).toBe('jump');
    expect(result.lineIndex).toBe(2);
    expect(result.globalWordIndex).toBe(4);
    expect(newWordIndex).toBe(4);
  });
});

describe('jumpBackBlocks', () => {
  it('returns null when at start of document', () => {
    const state = createDocumentState('Line one\nLine two\nLine three', []);
    // Position is at the beginning (line 0)

    const result = jumpBackBlocks(2, state, 0);

    expect(result).toBeNull();
  });

  it('jumps back correct number of lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createDocumentState(content, []);
    // Line 3 starts at globalIndex 6

    const result = jumpBackBlocks(2, state, 6);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(1); // Should jump from line 3 to line 1
  });

  it('clamps to beginning if N exceeds available lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createDocumentState(content, []);
    // Position at line 2 (globalIndex 4)

    const result = jumpBackBlocks(10, state, 4);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(0); // Should clamp to line 0
    expect(result!.globalWordIndex).toBe(0); // First word of line 0
  });
});

describe('jumpForwardBlocks', () => {
  it('returns null when at end of document', () => {
    const content = 'Line one\nLine two\nLine three';
    const state = createDocumentState(content, []);
    // Position at the last line (line 2, which starts at globalIndex 4)

    const result = jumpForwardBlocks(2, state, 4);

    expect(result).toBeNull();
  });

  it('jumps forward correct number of lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createDocumentState(content, []);
    // Start at line 1 (globalIndex 2)

    const result = jumpForwardBlocks(2, state, 2);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(3); // Should jump from line 1 to line 3
  });

  it('clamps to end if N exceeds available lines', () => {
    const content = 'Line zero\nLine one\nLine two\nLine three\nLine four';
    const state = createDocumentState(content, []);
    // Start at line 2 (globalIndex 4)

    const result = jumpForwardBlocks(10, state, 4);

    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(4); // Should clamp to last line (line 4)
  });
});

describe('jumpToSectionStart', () => {
  const content = '# Section One\nContent in section one\n\n# Section Two\nContent in section two\n\n# Section Three\nContent in section three';

  const anchors: SectionAnchor[] = [
    { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 0 },
    { id: '2', type: 'heading', level: 1, text: 'Section Two', normalizedText: 'section two', keywords: ['section', 'two'], charIndex: 38 },
    { id: '3', type: 'heading', level: 1, text: 'Section Three', normalizedText: 'section three', keywords: ['section', 'three'], charIndex: 76 },
  ];

  it('returns null with no headings in document', () => {
    const state = createDocumentState('Some plain text without headings', []);

    const result = jumpToSectionStart(state, 0);

    expect(result).toBeNull();
  });

  it('returns the heading that contains the current position', () => {
    const state = createDocumentState(content, anchors);
    // Position in "Content in section two" (line 3, word index 8)

    const result = jumpToSectionStart(state, 8);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('section two');
  });

  it('returns null when position is before any heading', () => {
    const contentWithPreamble = 'Preamble text here\n\n# Section One\nContent';
    const anchorsWithPreamble: SectionAnchor[] = [
      { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 20 },
    ];
    const state = createDocumentState(contentWithPreamble, anchorsWithPreamble);
    // Position at word 0 (in preamble, before any heading)

    const result = jumpToSectionStart(state, 0);

    expect(result).toBeNull();
  });

  it('works when already on a heading line', () => {
    const state = createDocumentState(content, anchors);
    // Position at the start of Section Two heading line (word index 6)

    const result = jumpToSectionStart(state, 6);

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
    const state = createDocumentState(content, anchors);
    // Position at the first section (word index 0)

    const result = jumpToPreviousSection(state, 0);

    expect(result).toBeNull();
  });

  it('returns null when before any heading', () => {
    const contentWithPreamble = 'Preamble text\n\n# Section One\nContent';
    const anchorsWithPreamble: SectionAnchor[] = [
      { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 15 },
    ];
    const state = createDocumentState(contentWithPreamble, anchorsWithPreamble);
    // Position at word 0 (in preamble)

    const result = jumpToPreviousSection(state, 0);

    expect(result).toBeNull();
  });

  it('returns the heading before the current section heading', () => {
    const state = createDocumentState(content, anchors);
    // Position in Section Two (word index 8)

    const result = jumpToPreviousSection(state, 8);

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
    const state = createDocumentState(content, anchors);
    // Position in Section Three (word index 14)

    const result = jumpToNextSection(state, 14);

    expect(result).toBeNull();
  });

  it('returns the first heading after current position', () => {
    const state = createDocumentState(content, anchors);
    // Position in Section One (word index 2)

    const result = jumpToNextSection(state, 2);

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
    const state = createDocumentState('', []);
    const result = getCurrentSectionBounds(state, 0);
    expect(result).toBeNull();
  });

  it('treats entire document as one section when no headings', () => {
    const state = createDocumentState('Some plain text without headings', []);
    const result = getCurrentSectionBounds(state, 0);

    expect(result).not.toBeNull();
    expect(result!.startWordIndex).toBe(0);
    expect(result!.endWordIndex).toBe(state.words.length - 1);
  });

  it('returns correct bounds for first section', () => {
    const state = createDocumentState(content, anchors);
    // Position in Section One (word index 2)

    const result = getCurrentSectionBounds(state, 2);

    expect(result).not.toBeNull();
    expect(result!.startWordIndex).toBe(0); // "section" from "# Section One"
  });

  it('returns correct bounds for middle section', () => {
    const state = createDocumentState(content, anchors);
    // Position in Section Two (word index 8)

    const result = getCurrentSectionBounds(state, 8);

    expect(result).not.toBeNull();
    // Section Two starts at word 6 ("section" from "# Section Two")
    expect(result!.startWordIndex).toBe(6);
  });

  it('returns correct bounds for last section', () => {
    const state = createDocumentState(content, anchors);
    // Position in Section Three (word index 14)

    const result = getCurrentSectionBounds(state, 14);

    expect(result).not.toBeNull();
    // Last section goes to end of document
    expect(result!.endWordIndex).toBe(state.words.length - 1);
  });

  it('handles preamble before first heading', () => {
    const contentWithPreamble = 'Preamble text here\n\n# Section One\nContent';
    const anchorsWithPreamble: SectionAnchor[] = [
      { id: '1', type: 'heading', level: 1, text: 'Section One', normalizedText: 'section one', keywords: ['section', 'one'], charIndex: 20 },
    ];
    const state = createDocumentState(contentWithPreamble, anchorsWithPreamble);
    // Position at word 0 (in preamble)

    const result = getCurrentSectionBounds(state, 0);

    expect(result).not.toBeNull();
    expect(result!.startWordIndex).toBe(0);
  });
});
