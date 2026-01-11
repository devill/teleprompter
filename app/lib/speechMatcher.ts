import { tokenize, normalizeNumber } from './textNormalizer';
import type { SectionAnchor } from './sectionParser';

export interface MatchResult {
  lineIndex: number;
  wordIndex: number;         // Word position within the line
  globalWordIndex: number;   // Word position in entire document
  matchType: 'advance' | 'jump';
}

export interface DocumentWord {
  word: string;              // Normalized word
  lineIndex: number;
  wordIndexInLine: number;
  globalIndex: number;
}

export interface DocumentState {
  words: DocumentWord[];     // Flattened word list
  lineCount: number;
  sectionAnchors: SectionAnchor[];
}

export interface JumpSearchResult {
  lineIndex: number;
  globalWordIndex: number;
  score: number;
  matchedText: string;
}

export interface SectionBounds {
  startWordIndex: number;
  endWordIndex: number;
}

const LOOK_AHEAD_WORDS = 5;
const HEADER_BONUS = 50;
const NUMBERED_SECTION_BONUS = 30;
const MAX_DISTANCE_PENALTY = 20;

export function createDocumentState(
  content: string,
  sectionAnchors: SectionAnchor[]
): DocumentState {
  const lines = content.split('\n').filter(line => line.trim());
  const words: DocumentWord[] = [];

  let globalIndex = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineTokens = tokenize(lines[lineIndex]);
    for (let wordIndexInLine = 0; wordIndexInLine < lineTokens.length; wordIndexInLine++) {
      words.push({
        word: lineTokens[wordIndexInLine],
        lineIndex,
        wordIndexInLine,
        globalIndex,
      });
      globalIndex++;
    }
  }

  return {
    words,
    lineCount: lines.length,
    sectionAnchors,
  };
}

// Process a single newly spoken word and return updated position
export function processSpokenWord(
  spokenWord: string,
  state: DocumentState,
  currentWordIndex: number
): { result: MatchResult | null; newWordIndex: number } {
  const normalized = tokenize(spokenWord)[0] || spokenWord.toLowerCase();

  if (!normalized) {
    return { result: null, newWordIndex: currentWordIndex };
  }

  // Look ahead from current position for a match
  const startIdx = currentWordIndex;
  const endIdx = Math.min(state.words.length, startIdx + LOOK_AHEAD_WORDS);

  for (let i = startIdx; i < endIdx; i++) {
    if (wordsMatch(normalized, state.words[i].word)) {
      const matchedWord = state.words[i];

      return {
        result: {
          lineIndex: matchedWord.lineIndex,
          wordIndex: matchedWord.wordIndexInLine,
          globalWordIndex: i,
          matchType: 'advance',
        },
        newWordIndex: i + 1,
      };
    }
  }

  return { result: null, newWordIndex: currentWordIndex };
}

// Search document for jump targets matching spoken text
export function searchForJumpTarget(
  targetWords: string[],
  state: DocumentState,
  currentWordIndex: number
): JumpSearchResult | null {
  if (targetWords.length === 0 || state.words.length === 0) {
    return null;
  }

  const normalizedTarget = targetWords
    .map(w => tokenize(w)[0] || w.toLowerCase())
    .filter(Boolean);

  if (normalizedTarget.length === 0) {
    return null;
  }

  // Group words by line for easier searching
  const lineGroups = new Map<number, { words: string[]; firstWordIndex: number }>();
  for (const word of state.words) {
    if (!lineGroups.has(word.lineIndex)) {
      lineGroups.set(word.lineIndex, { words: [], firstWordIndex: word.globalIndex });
    }
    lineGroups.get(word.lineIndex)!.words.push(word.word);
  }

  let bestMatch: JumpSearchResult | null = null;

  for (const [lineIndex, { words: lineWords, firstWordIndex }] of lineGroups) {
    const matchScore = scoreLineMatch(normalizedTarget, lineWords);

    if (matchScore > 0) {
      // Calculate bonuses
      let totalScore = matchScore;
      const matchedText = lineWords.slice(0, 6).join(' ');

      // Header bonus
      const isHeader = state.sectionAnchors.some(
        anchor => anchor.type === 'heading' && findAnchorLine(anchor, lineGroups) === lineIndex
      );
      if (isHeader) {
        totalScore += HEADER_BONUS;
      }

      // Numbered section bonus
      const isNumberedSection = state.sectionAnchors.some(
        anchor => anchor.type === 'numbered' && findAnchorLine(anchor, lineGroups) === lineIndex
      );
      if (isNumberedSection) {
        totalScore += NUMBERED_SECTION_BONUS;
      }

      // Distance penalty (further away = lower score)
      const distance = Math.abs(firstWordIndex - currentWordIndex);
      const maxDistance = state.words.length;
      const distancePenalty = (distance / maxDistance) * MAX_DISTANCE_PENALTY;
      totalScore -= distancePenalty;

      if (!bestMatch || totalScore > bestMatch.score) {
        bestMatch = {
          lineIndex,
          globalWordIndex: firstWordIndex,
          score: totalScore,
          matchedText,
        };
      }
    }
  }

  return bestMatch;
}

// Apply a jump result and return the match result with new position
export function applyJump(
  jumpResult: JumpSearchResult
): { result: MatchResult; newWordIndex: number } {
  return {
    result: {
      lineIndex: jumpResult.lineIndex,
      wordIndex: 0,
      globalWordIndex: jumpResult.globalWordIndex,
      matchType: 'jump',
    },
    newWordIndex: jumpResult.globalWordIndex,
  };
}

// Jump back by a number of blocks (non-empty lines)
export function jumpBackBlocks(
  blockCount: number,
  state: DocumentState,
  currentWordIndex: number
): JumpSearchResult | null {
  if (state.words.length === 0 || blockCount <= 0) {
    return null;
  }

  const currentWord = state.words[currentWordIndex];
  if (!currentWord) {
    return null;
  }

  const currentLineIndex = currentWord.lineIndex;

  // Already at line 0, can't go back
  if (currentLineIndex === 0) {
    return null;
  }

  // Calculate target line, clamping to 0
  const targetLineIndex = Math.max(0, currentLineIndex - blockCount);

  // Find the first word of the target line
  const targetWord = state.words.find(w => w.lineIndex === targetLineIndex);
  if (!targetWord) {
    return null;
  }

  // Build matched text from the first few words of the target line
  const lineWords = state.words
    .filter(w => w.lineIndex === targetLineIndex)
    .slice(0, 5)
    .map(w => w.word);

  return {
    lineIndex: targetLineIndex,
    globalWordIndex: targetWord.globalIndex,
    score: 100,
    matchedText: lineWords.join(' '),
  };
}

// Jump forward by a number of blocks (non-empty lines)
export function jumpForwardBlocks(
  blockCount: number,
  state: DocumentState,
  currentWordIndex: number
): JumpSearchResult | null {
  if (state.words.length === 0 || blockCount <= 0) {
    return null;
  }

  const currentWord = state.words[currentWordIndex];
  if (!currentWord) {
    return null;
  }

  const currentLineIndex = currentWord.lineIndex;
  const lastLineIndex = state.lineCount - 1;

  // Already at last line, can't go forward
  if (currentLineIndex >= lastLineIndex) {
    return null;
  }

  // Calculate target line, clamping to last line
  const targetLineIndex = Math.min(lastLineIndex, currentLineIndex + blockCount);

  // Find the first word of the target line
  const targetWord = state.words.find(w => w.lineIndex === targetLineIndex);
  if (!targetWord) {
    return null;
  }

  // Build matched text from the first few words of the target line
  const lineWords = state.words
    .filter(w => w.lineIndex === targetLineIndex)
    .slice(0, 5)
    .map(w => w.word);

  return {
    lineIndex: targetLineIndex,
    globalWordIndex: targetWord.globalIndex,
    score: 100,
    matchedText: lineWords.join(' '),
  };
}

// Score how well target words match a line
function scoreLineMatch(targetWords: string[], lineWords: string[]): number {
  let matchedCount = 0;
  let consecutiveBonus = 0;
  let lastMatchIndex = -2;

  for (const target of targetWords) {
    for (let i = 0; i < lineWords.length; i++) {
      if (wordsMatch(target, lineWords[i])) {
        matchedCount++;
        // Bonus for consecutive matches
        if (i === lastMatchIndex + 1) {
          consecutiveBonus += 5;
        }
        lastMatchIndex = i;
        break;
      }
    }
  }

  if (matchedCount === 0) {
    return 0;
  }

  // Base score: percentage of target words matched
  const matchRatio = matchedCount / targetWords.length;
  const baseScore = matchRatio * 100;

  return baseScore + consecutiveBonus;
}

// Find which line an anchor belongs to
function findAnchorLine(
  anchor: SectionAnchor,
  lineGroups: Map<number, { words: string[]; firstWordIndex: number }>
): number {
  const anchorWords = tokenize(anchor.text);
  let bestLine = 0;
  let bestScore = 0;

  for (const [lineIndex, { words }] of lineGroups) {
    let score = 0;
    for (const anchorWord of anchorWords) {
      if (words.some(w => wordsMatch(anchorWord, w))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLine = lineIndex;
    }
  }

  return bestLine;
}

function wordsMatch(spoken: string, document: string): boolean {
  if (spoken === document) {
    return true;
  }

  // Number equivalence (5 = five, etc.)
  if (numbersEquivalent(spoken, document)) {
    return true;
  }

  // Prefix match: speech recognition gave partial word (e.g., "beauti" for "beautiful")
  // Only match if spoken is a prefix of document, not the reverse
  // This prevents "lesson" matching "less"
  if (spoken.length >= 4 && document.startsWith(spoken)) {
    return true;
  }

  // Handle common mishearings - allow 1 character difference for longer words
  if (spoken.length >= 5 && document.length >= 5) {
    if (levenshteinDistance(spoken, document) <= 1) {
      return true;
    }
  }

  return false;
}

function numbersEquivalent(a: string, b: string): boolean {
  const normalizedA = normalizeNumber(a);
  const normalizedB = normalizeNumber(b);
  return normalizedA === b || normalizedB === a || normalizedA === normalizedB;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Build line groups from state words for anchor matching
function buildLineGroups(state: DocumentState): Map<number, { words: string[]; firstWordIndex: number }> {
  const lineGroups = new Map<number, { words: string[]; firstWordIndex: number }>();
  for (const word of state.words) {
    if (!lineGroups.has(word.lineIndex)) {
      lineGroups.set(word.lineIndex, { words: [], firstWordIndex: word.globalIndex });
    }
    lineGroups.get(word.lineIndex)!.words.push(word.word);
  }
  return lineGroups;
}

// Get heading anchors with their line indices sorted by line index
function getHeadingsWithLineIndices(
  state: DocumentState
): Array<{ anchor: SectionAnchor; lineIndex: number }> {
  const headings = state.sectionAnchors.filter(a => a.type === 'heading');
  if (headings.length === 0) {
    return [];
  }

  const lineGroups = buildLineGroups(state);
  const result: Array<{ anchor: SectionAnchor; lineIndex: number }> = [];

  for (const anchor of headings) {
    const lineIndex = findAnchorLine(anchor, lineGroups);
    result.push({ anchor, lineIndex });
  }

  result.sort((a, b) => a.lineIndex - b.lineIndex);
  return result;
}

// Jump to the start of the current section (its heading)
export function jumpToSectionStart(
  state: DocumentState,
  currentWordIndex: number
): JumpSearchResult | null {
  const headingsWithLines = getHeadingsWithLineIndices(state);
  if (headingsWithLines.length === 0) {
    return null;
  }

  const currentWord = state.words[currentWordIndex];
  if (!currentWord) {
    return null;
  }

  const currentLineIndex = currentWord.lineIndex;

  // Find the heading whose line is <= current line (the section we're in)
  let currentSectionHeading: { anchor: SectionAnchor; lineIndex: number } | null = null;
  for (const h of headingsWithLines) {
    if (h.lineIndex <= currentLineIndex) {
      currentSectionHeading = h;
    } else {
      break;
    }
  }

  if (!currentSectionHeading) {
    // We're before any heading
    return null;
  }

  // Find the first word of the heading's line
  const targetWord = state.words.find(w => w.lineIndex === currentSectionHeading!.lineIndex);
  if (!targetWord) {
    return null;
  }

  // Build matched text from the first few words of the heading line
  const lineWords = state.words
    .filter(w => w.lineIndex === currentSectionHeading!.lineIndex)
    .slice(0, 5)
    .map(w => w.word);

  return {
    lineIndex: currentSectionHeading.lineIndex,
    globalWordIndex: targetWord.globalIndex,
    score: 100,
    matchedText: lineWords.join(' '),
  };
}

// Jump to the previous section heading
export function jumpToPreviousSection(
  state: DocumentState,
  currentWordIndex: number
): JumpSearchResult | null {
  const headingsWithLines = getHeadingsWithLineIndices(state);
  if (headingsWithLines.length === 0) {
    return null;
  }

  const currentWord = state.words[currentWordIndex];
  if (!currentWord) {
    return null;
  }

  const currentLineIndex = currentWord.lineIndex;

  // Find the heading whose line is <= current line (the section we're in)
  let currentSectionIndex = -1;
  for (let i = 0; i < headingsWithLines.length; i++) {
    if (headingsWithLines[i].lineIndex <= currentLineIndex) {
      currentSectionIndex = i;
    } else {
      break;
    }
  }

  if (currentSectionIndex < 1) {
    // We're in the first section or before any heading - no previous section
    return null;
  }

  const previousHeading = headingsWithLines[currentSectionIndex - 1];

  // Find the first word of the previous heading's line
  const targetWord = state.words.find(w => w.lineIndex === previousHeading.lineIndex);
  if (!targetWord) {
    return null;
  }

  // Build matched text from the first few words of the heading line
  const lineWords = state.words
    .filter(w => w.lineIndex === previousHeading.lineIndex)
    .slice(0, 5)
    .map(w => w.word);

  return {
    lineIndex: previousHeading.lineIndex,
    globalWordIndex: targetWord.globalIndex,
    score: 100,
    matchedText: lineWords.join(' '),
  };
}

// Jump to the next section heading
export function jumpToNextSection(
  state: DocumentState,
  currentWordIndex: number
): JumpSearchResult | null {
  const headingsWithLines = getHeadingsWithLineIndices(state);
  if (headingsWithLines.length === 0) {
    return null;
  }

  const currentWord = state.words[currentWordIndex];
  if (!currentWord) {
    return null;
  }

  const currentLineIndex = currentWord.lineIndex;

  // Find the first heading whose line is > current line
  const nextHeading = headingsWithLines.find(h => h.lineIndex > currentLineIndex);
  if (!nextHeading) {
    return null;
  }

  // Find the first word of the next heading's line
  const targetWord = state.words.find(w => w.lineIndex === nextHeading.lineIndex);
  if (!targetWord) {
    return null;
  }

  // Build matched text from the first few words of the heading line
  const lineWords = state.words
    .filter(w => w.lineIndex === nextHeading.lineIndex)
    .slice(0, 5)
    .map(w => w.word);

  return {
    lineIndex: nextHeading.lineIndex,
    globalWordIndex: targetWord.globalIndex,
    score: 100,
    matchedText: lineWords.join(' '),
  };
}

// Get the boundaries of the current section for loop mode
export function getCurrentSectionBounds(
  state: DocumentState,
  currentWordIndex: number
): SectionBounds | null {
  const headingsWithLines = getHeadingsWithLineIndices(state);

  // If no headings, treat entire document as one section
  if (headingsWithLines.length === 0) {
    if (state.words.length === 0) {
      return null;
    }
    return {
      startWordIndex: 0,
      endWordIndex: state.words.length - 1,
    };
  }

  const currentWord = state.words[currentWordIndex];
  if (!currentWord) {
    return null;
  }

  const currentLineIndex = currentWord.lineIndex;

  // Find the current section (heading whose line <= current position)
  let currentSectionIndex = -1;
  for (let i = 0; i < headingsWithLines.length; i++) {
    if (headingsWithLines[i].lineIndex <= currentLineIndex) {
      currentSectionIndex = i;
    } else {
      break;
    }
  }

  // Before any heading - treat content from start to first heading as a section
  if (currentSectionIndex === -1) {
    const firstHeadingLine = headingsWithLines[0].lineIndex;
    const endWord = state.words.findLast(w => w.lineIndex < firstHeadingLine);
    return {
      startWordIndex: 0,
      endWordIndex: endWord ? endWord.globalIndex : 0,
    };
  }

  // Find start word of current section
  const currentHeading = headingsWithLines[currentSectionIndex];
  const startWord = state.words.find(w => w.lineIndex === currentHeading.lineIndex);
  if (!startWord) {
    return null;
  }

  // Find end word: last word before next section, or last word of document
  let endWordIndex: number;
  if (currentSectionIndex < headingsWithLines.length - 1) {
    // There's a next section
    const nextHeading = headingsWithLines[currentSectionIndex + 1];
    const endWord = state.words.findLast(w => w.lineIndex < nextHeading.lineIndex);
    endWordIndex = endWord ? endWord.globalIndex : startWord.globalIndex;
  } else {
    // Last section - goes to end of document
    endWordIndex = state.words.length - 1;
  }

  return {
    startWordIndex: startWord.globalIndex,
    endWordIndex,
  };
}
