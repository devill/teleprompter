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
  charIndexToLineIndex,
  jumpToNextParagraph,
  jumpToPreviousParagraph,
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
    expect(state.words[0]).toEqual({ word: 'first', lineIndex: 0, wordIndexInLine: 0, globalIndex: 0, speakable: true });
    expect(state.words[1]).toEqual({ word: 'line', lineIndex: 0, wordIndexInLine: 1, globalIndex: 1, speakable: true });
    expect(state.words[2]).toEqual({ word: 'second', lineIndex: 1, wordIndexInLine: 0, globalIndex: 2, speakable: true });
    expect(state.words[3]).toEqual({ word: 'line', lineIndex: 1, wordIndexInLine: 1, globalIndex: 3, speakable: true });
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

  it('skips [hidden] text completely', () => {
    const content = 'Hello [hidden note] world';
    const state = createDocumentState(content, []);

    expect(state.words.length).toBe(2);
    expect(state.words[0].word).toBe('hello');
    expect(state.words[1].word).toBe('world');
  });

  it('marks {visible} content as non-speakable', () => {
    const content = 'Hello {stage direction} world';
    const state = createDocumentState(content, []);

    expect(state.words.length).toBe(4);
    expect(state.words[0]).toMatchObject({ word: 'hello', speakable: true });
    expect(state.words[1]).toMatchObject({ word: 'stage', speakable: false });
    expect(state.words[2]).toMatchObject({ word: 'direction', speakable: false });
    expect(state.words[3]).toMatchObject({ word: 'world', speakable: true });
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

  it('skips non-speakable words when matching', () => {
    // "pause" is non-speakable so "world" should be found within look-ahead
    const state = createTestState('Hello {pause} world');
    const { result, newWordIndex } = processSpokenWord('world', state, 0);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(2); // "world" is at index 2 (hello=0, pause=1, world=2)
    expect(newWordIndex).toBe(3);
  });

  it('advances past non-speakable words after match', () => {
    const state = createTestState('Hello {pause briefly} world');
    // Match "hello" - should advance past "pause" and "briefly"
    const { result, newWordIndex } = processSpokenWord('hello', state, 0);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(0);
    // newWordIndex should be 3 (after "hello", skip "pause" and "briefly", land on "world")
    expect(newWordIndex).toBe(3);
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

describe('charIndexToLineIndex', () => {
  it('returns 0 for character index at start of content', () => {
    const content = 'First line\nSecond line';
    expect(charIndexToLineIndex(0, content)).toBe(0);
  });

  it('returns 0 for character index within first line', () => {
    const content = 'First line\nSecond line';
    expect(charIndexToLineIndex(5, content)).toBe(0);
  });

  it('returns 1 for character index at start of second line', () => {
    const content = 'First line\nSecond line';
    // Character 11 is 'S' in 'Second'
    expect(charIndexToLineIndex(11, content)).toBe(1);
  });

  it('returns correct line for multi-line content', () => {
    const content = 'Line 0\nLine 1\nLine 2\nLine 3';
    // 'Line 2' starts at char 14
    expect(charIndexToLineIndex(14, content)).toBe(2);
  });

  it('handles content with blank lines', () => {
    const content = 'Para one\n\nPara two';
    // 'Para two' starts at char 10
    expect(charIndexToLineIndex(10, content)).toBe(2);
  });

  it('returns -1 for character index beyond content', () => {
    const content = 'Short';
    expect(charIndexToLineIndex(100, content)).toBe(-1);
  });
});

describe('jumpToNextParagraph', () => {
  it('returns null for empty content', () => {
    const state = createDocumentState('', []);
    const result = jumpToNextParagraph('', state, 0);
    expect(result).toBeNull();
  });

  it('returns null when already at the last paragraph', () => {
    const content = 'First para\n\nSecond para';
    const state = createDocumentState(content, []);
    // Position at word 2, which is in the second (last) paragraph
    const result = jumpToNextParagraph(content, state, 2);
    expect(result).toBeNull();
  });

  it('jumps from first paragraph to second paragraph', () => {
    const content = 'First para text\n\nSecond para text';
    const state = createDocumentState(content, []);
    // Position at word 0 (in first paragraph)
    const result = jumpToNextParagraph(content, state, 0);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('second');
  });

  it('jumps to next paragraph when in middle of current paragraph', () => {
    const content = 'First para has many words\n\nSecond para text';
    const state = createDocumentState(content, []);
    // Position at word 3 (still in first paragraph)
    const result = jumpToNextParagraph(content, state, 3);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('second');
  });

  it('handles multiple paragraphs', () => {
    const content = 'First.\n\nSecond.\n\nThird.';
    const state = createDocumentState(content, []);
    // Position at word 0 (in first paragraph)
    const result = jumpToNextParagraph(content, state, 0);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('second');

    // Now jump from second to third
    const result2 = jumpToNextParagraph(content, state, result!.globalWordIndex);
    expect(result2).not.toBeNull();
    expect(result2!.matchedText).toContain('third');
  });

  it('handles paragraphs with multiple lines', () => {
    const content = 'Line one of para 1\nLine two of para 1\n\nLine one of para 2';
    const state = createDocumentState(content, []);
    // Position at word 0 (in first paragraph, first line)
    const result = jumpToNextParagraph(content, state, 0);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('line one of para');
  });
});

describe('jumpToPreviousParagraph', () => {
  it('returns null for empty content', () => {
    const state = createDocumentState('', []);
    const result = jumpToPreviousParagraph('', state, 0);
    expect(result).toBeNull();
  });

  it('returns null when already at the first paragraph', () => {
    const content = 'First para\n\nSecond para';
    const state = createDocumentState(content, []);
    // Position at word 0 (in first paragraph)
    const result = jumpToPreviousParagraph(content, state, 0);
    expect(result).toBeNull();
  });

  it('jumps from second paragraph to first paragraph', () => {
    const content = 'First para text\n\nSecond para text';
    const state = createDocumentState(content, []);
    // Position at word 3, which is in second paragraph (after first 3 words: first, para, text)
    const result = jumpToPreviousParagraph(content, state, 3);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('first');
    expect(result!.globalWordIndex).toBe(0);
  });

  it('handles multiple paragraphs', () => {
    const content = 'First.\n\nSecond.\n\nThird.';
    const state = createDocumentState(content, []);
    // Position at word 2 (in third paragraph: "third")
    const result = jumpToPreviousParagraph(content, state, 2);

    expect(result).not.toBeNull();
    expect(result!.matchedText).toContain('second');
  });

  it('handles paragraphs with multiple lines', () => {
    const content = 'Line one of para 1\nLine two of para 1\n\nLine one of para 2';
    const state = createDocumentState(content, []);
    // Find position in second paragraph - state has 10 words from first para (line one of para 1 + line two of para 1)
    const result = jumpToPreviousParagraph(content, state, 10);

    expect(result).not.toBeNull();
    expect(result!.globalWordIndex).toBe(0);
  });
});
