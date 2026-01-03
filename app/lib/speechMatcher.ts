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

export interface MatcherState {
  currentWordIndex: number;  // Current position in document (global word index)
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

const LOOK_AHEAD_WORDS = 5;
const HEADER_BONUS = 50;
const NUMBERED_SECTION_BONUS = 30;
const MAX_DISTANCE_PENALTY = 20;

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
        },
      };
    }
  }

  return { result: null, newState: state };
}

// Search document for jump targets matching spoken text
export function searchForJumpTarget(
  targetWords: string[],
  state: MatcherState
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
      let matchedText = lineWords.slice(0, 6).join(' ');

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
      const distance = Math.abs(firstWordIndex - state.currentWordIndex);
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

// Apply a jump result to the state
export function applyJump(
  jumpResult: JumpSearchResult,
  state: MatcherState
): { result: MatchResult; newState: MatcherState } {
  return {
    result: {
      lineIndex: jumpResult.lineIndex,
      wordIndex: 0,
      globalWordIndex: jumpResult.globalWordIndex,
      matchType: 'jump',
    },
    newState: {
      ...state,
      currentWordIndex: jumpResult.globalWordIndex,
    },
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
