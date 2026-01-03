import { normalizeText, normalizeNumber } from './textNormalizer';

export interface SectionAnchor {
  id: string;
  type: 'heading' | 'numbered';
  level: number;
  text: string;
  normalizedText: string;
  keywords: string[];
  charIndex: number;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/gm;
// Match "Lesson 1", "Lesson #1", "Lesson # 1"
const LESSON_PATTERN = /Lesson\s*#?\s*(\d+)/gi;
// Match "Chapter 1", "Chapter #1"
const CHAPTER_PATTERN = /Chapter\s*#?\s*(\d+)/gi;

function extractKeywords(text: string, numberMatches: string[] = []): string[] {
  const keywords: string[] = [];
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => w.length > 0);

  for (const word of words) {
    if (!keywords.includes(word)) {
      keywords.push(word);
    }
  }

  for (const num of numberMatches) {
    const digit = num;
    const word = normalizeNumber(num);

    if (!keywords.includes(digit)) {
      keywords.push(digit);
    }
    if (word !== digit && !keywords.includes(word)) {
      keywords.push(word);
    }
    // Add "number" as a keyword since people often say "lesson number one"
    if (!keywords.includes('number')) {
      keywords.push('number');
    }
  }

  return keywords;
}

function findNumberedPatterns(content: string): SectionAnchor[] {
  const anchors: SectionAnchor[] = [];
  const seenIndices = new Set<number>();

  const lessonMatches = content.matchAll(LESSON_PATTERN);
  for (const match of lessonMatches) {
    if (match.index !== undefined && !seenIndices.has(match.index)) {
      seenIndices.add(match.index);
      const number = match[1];
      const text = match[0];
      anchors.push({
        id: crypto.randomUUID(),
        type: 'numbered',
        level: 0,
        text,
        normalizedText: normalizeText(text),
        keywords: extractKeywords(text, [number]),
        charIndex: match.index,
      });
    }
  }

  const chapterMatches = content.matchAll(CHAPTER_PATTERN);
  for (const match of chapterMatches) {
    if (match.index !== undefined && !seenIndices.has(match.index)) {
      seenIndices.add(match.index);
      const number = match[1];
      const text = match[0];
      anchors.push({
        id: crypto.randomUUID(),
        type: 'numbered',
        level: 0,
        text,
        normalizedText: normalizeText(text),
        keywords: extractKeywords(text, [number]),
        charIndex: match.index,
      });
    }
  }

  return anchors;
}

interface HeadingWithRange extends SectionAnchor {
  endIndex: number;
}

function findHeadings(content: string): HeadingWithRange[] {
  const anchors: HeadingWithRange[] = [];
  const matches = content.matchAll(HEADING_PATTERN);

  for (const match of matches) {
    if (match.index === undefined) continue;

    const hashes = match[1];
    const text = match[2];
    const level = hashes.length;
    const fullMatch = match[0];

    const numberMatches: string[] = [];
    const digitPattern = /\d+/g;
    let digitMatch;
    while ((digitMatch = digitPattern.exec(text)) !== null) {
      numberMatches.push(digitMatch[0]);
    }

    anchors.push({
      id: crypto.randomUUID(),
      type: 'heading',
      level,
      text,
      normalizedText: normalizeText(text),
      keywords: extractKeywords(text, numberMatches),
      charIndex: match.index,
      endIndex: match.index + fullMatch.length,
    });
  }

  return anchors;
}

function isWithinHeading(charIndex: number, headings: HeadingWithRange[]): boolean {
  return headings.some(h => charIndex >= h.charIndex && charIndex < h.endIndex);
}

export function parseSections(content: string): SectionAnchor[] {
  const headings = findHeadings(content);
  const numbered = findNumberedPatterns(content);

  const uniqueNumbered = numbered.filter(n => !isWithinHeading(n.charIndex, headings));

  const headingsWithoutRange: SectionAnchor[] = headings.map(h => ({
    id: h.id,
    type: h.type,
    level: h.level,
    text: h.text,
    normalizedText: h.normalizedText,
    keywords: h.keywords,
    charIndex: h.charIndex,
  }));

  const allAnchors = [...headingsWithoutRange, ...uniqueNumbered];

  allAnchors.sort((a, b) => a.charIndex - b.charIndex);

  return allAnchors;
}
