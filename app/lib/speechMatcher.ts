import { tokenize, normalizeNumber } from './textNormalizer';
import type { SectionAnchor } from './sectionParser';

export interface MatchResult {
  lineIndex: number;
  wordIndex: number;         // Word position within the line
  globalWordIndex: number;   // Word position in entire document
  matchType: 'advance' | 'section_jump';
}

export interface DocumentWord {
  word: string;              // Normalized word
  lineIndex: number;
  wordIndexInLine: number;
  globalIndex: number;
}

export interface MatcherState {
  currentWordIndex: number;  // Current position in document (global word index)
  words: DocumentWord[];     // Flattened word list
  lineCount: number;
  sectionAnchors: SectionAnchor[];
  lostCounter: number;       // How many consecutive non-matches
}

const LOOK_AHEAD_WORDS = 5;      // How far ahead to look for matches
const LOST_THRESHOLD = 5;        // How many non-matches before considering section jump (lowered for testing)
const MIN_SECTION_KEYWORDS = 2;

export function createMatcherState(
  content: string,
  sectionAnchors: SectionAnchor[]
): MatcherState {
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
    currentWordIndex: 0,
    words,
    lineCount: lines.length,
    sectionAnchors,
    lostCounter: 0,
  };
}

// Process a single newly spoken word and return updated position
export function processSpokenWord(
  spokenWord: string,
  state: MatcherState
): { result: MatchResult | null; newState: MatcherState } {
  const normalized = tokenize(spokenWord)[0] || spokenWord.toLowerCase();

  if (!normalized) {
    return { result: null, newState: state };
  }

  // Look ahead from current position for a match
  const startIdx = state.currentWordIndex;
  const endIdx = Math.min(state.words.length, startIdx + LOOK_AHEAD_WORDS);

  for (let i = startIdx; i < endIdx; i++) {
    if (wordsMatch(normalized, state.words[i].word)) {
      // Found a match - advance to this position + 1
      const matchedWord = state.words[i];
      const newWordIndex = i + 1;

      return {
        result: {
          lineIndex: matchedWord.lineIndex,
          wordIndex: matchedWord.wordIndexInLine,
          globalWordIndex: i,
          matchType: 'advance',
        },
        newState: {
          ...state,
          currentWordIndex: newWordIndex,
          lostCounter: 0,  // Reset lost counter on match
        },
      };
    }
  }

  // No match found - increment lost counter but don't move
  const newLostCounter = state.lostCounter + 1;

  return {
    result: null,
    newState: {
      ...state,
      lostCounter: newLostCounter,
    },
  };
}

// Check if we should jump to a section (when lost and section keywords detected)
export function checkSectionJump(
  recentWords: string[],
  state: MatcherState
): { result: MatchResult | null; newState: MatcherState } {
  const normalizedWords = recentWords.map(w => tokenize(w)[0] || w.toLowerCase()).filter(Boolean);

  console.log('[SectionJump] Checking...', {
    lostCounter: state.lostCounter,
    threshold: LOST_THRESHOLD,
    recentWords: normalizedWords,
    anchorsCount: state.sectionAnchors.length,
  });

  // Only consider section jump if we've been lost for a while
  if (state.lostCounter < LOST_THRESHOLD) {
    console.log('[SectionJump] Not lost enough yet');
    return { result: null, newState: state };
  }

  for (const anchor of state.sectionAnchors) {
    const matchingKeywords = countMatchingKeywords(normalizedWords, anchor.keywords);
    console.log('[SectionJump] Checking anchor:', {
      text: anchor.text,
      keywords: anchor.keywords,
      matchingKeywords,
      required: MIN_SECTION_KEYWORDS,
    });

    if (matchingKeywords >= MIN_SECTION_KEYWORDS) {
      // Find the line that contains this section
      const sectionLineIndex = findLineForSection(anchor, state);
      const sectionWordIndex = state.words.findIndex(w => w.lineIndex === sectionLineIndex);

      console.log('[SectionJump] JUMPING to:', { sectionLineIndex, sectionWordIndex, anchorText: anchor.text });

      if (sectionWordIndex >= 0) {
        return {
          result: {
            lineIndex: sectionLineIndex,
            wordIndex: 0,
            globalWordIndex: sectionWordIndex,
            matchType: 'section_jump',
          },
          newState: {
            ...state,
            currentWordIndex: sectionWordIndex,
            lostCounter: 0,
          },
        };
      }
    }
  }

  return { result: null, newState: state };
}

// Legacy function for compatibility - processes multiple words
export function matchSpokenText(
  spokenWords: string[],
  state: MatcherState
): MatchResult | null {
  if (spokenWords.length === 0 || state.words.length === 0) {
    return null;
  }

  // Process the last spoken word
  const lastWord = spokenWords[spokenWords.length - 1];
  const { result } = processSpokenWord(lastWord, state);

  if (result) {
    return result;
  }

  // Check for section jump with recent words
  const { result: sectionResult } = checkSectionJump(spokenWords.slice(-5), state);
  return sectionResult;
}

function wordsMatch(spoken: string, document: string): boolean {
  if (spoken === document) {
    return true;
  }

  // Number equivalence (5 = five, etc.)
  if (numbersEquivalent(spoken, document)) {
    return true;
  }

  // Prefix match for longer words (handles partial recognition)
  if (spoken.length >= 4 && document.startsWith(spoken)) {
    return true;
  }
  if (document.length >= 4 && spoken.startsWith(document)) {
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

function countMatchingKeywords(spokenWords: string[], keywords: string[]): number {
  let count = 0;
  for (const keyword of keywords) {
    for (const spoken of spokenWords) {
      if (wordsMatch(spoken, keyword)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function findLineForSection(anchor: SectionAnchor, state: MatcherState): number {
  // Search for the anchor text in document lines to find the right line
  const normalizedAnchorText = anchor.normalizedText.toLowerCase();
  const anchorWords = normalizedAnchorText.split(/\s+/).filter(w => w);

  // Find a line that contains the anchor keywords
  let bestLineIndex = 0;
  let bestMatchCount = 0;

  const lineGroups = new Map<number, string[]>();
  for (const word of state.words) {
    if (!lineGroups.has(word.lineIndex)) {
      lineGroups.set(word.lineIndex, []);
    }
    lineGroups.get(word.lineIndex)!.push(word.word);
  }

  for (const [lineIndex, lineWords] of lineGroups) {
    let matchCount = 0;
    for (const anchorWord of anchorWords) {
      if (lineWords.some(w => w === anchorWord || wordsMatch(anchorWord, w))) {
        matchCount++;
      }
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestLineIndex = lineIndex;
    }
  }

  console.log('[findLineForSection]', { anchorText: anchor.text, bestLineIndex, bestMatchCount });
  return bestLineIndex;
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
