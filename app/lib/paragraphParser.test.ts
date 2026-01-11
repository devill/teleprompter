import { describe, it, expect } from 'vitest';
import { parseParagraphs } from './paragraphParser';

describe('parseParagraphs', () => {
  describe('empty and edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseParagraphs('')).toEqual([]);
    });

    it('returns empty array for whitespace only', () => {
      expect(parseParagraphs('   \n\n   ')).toEqual([]);
    });
  });

  describe('single paragraph', () => {
    it('returns one anchor at position 0 for single paragraph', () => {
      const content = 'This is a single paragraph.';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(1);
      expect(result[0].startCharIndex).toBe(0);
    });

    it('returns one anchor for paragraph with internal newlines', () => {
      const content = 'Line one.\nLine two.\nLine three.';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(1);
      expect(result[0].startCharIndex).toBe(0);
    });
  });

  describe('multiple paragraphs', () => {
    it('detects two paragraphs separated by blank line', () => {
      const content = 'First paragraph.\n\nSecond paragraph.';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(2);
      expect(result[0].startCharIndex).toBe(0);
      expect(result[1].startCharIndex).toBe(18);
      expect(content.slice(result[1].startCharIndex)).toBe('Second paragraph.');
    });

    it('detects three paragraphs', () => {
      const content = 'One.\n\nTwo.\n\nThree.';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(3);
      expect(content.slice(result[0].startCharIndex, result[0].startCharIndex + 4)).toBe('One.');
      expect(content.slice(result[1].startCharIndex, result[1].startCharIndex + 4)).toBe('Two.');
      expect(content.slice(result[2].startCharIndex)).toBe('Three.');
    });
  });

  describe('multiple blank lines', () => {
    it('handles paragraphs separated by multiple blank lines', () => {
      const content = 'First.\n\n\n\nSecond.';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(2);
      expect(result[0].startCharIndex).toBe(0);
      expect(content.slice(result[1].startCharIndex)).toBe('Second.');
    });

    it('handles varied numbers of blank lines between paragraphs', () => {
      const content = 'A.\n\nB.\n\n\nC.\n\n\n\nD.';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(4);
    });
  });

  describe('leading and trailing blank lines', () => {
    it('ignores leading blank lines', () => {
      const content = '\n\nFirst paragraph.';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(1);
      expect(content.slice(result[0].startCharIndex)).toBe('First paragraph.');
    });

    it('ignores trailing blank lines', () => {
      const content = 'Last paragraph.\n\n';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(1);
      expect(result[0].startCharIndex).toBe(0);
    });

    it('handles both leading and trailing blank lines', () => {
      const content = '\n\n\nMiddle paragraph.\n\n\n';
      const result = parseParagraphs(content);

      expect(result).toHaveLength(1);
      expect(content.slice(result[0].startCharIndex, result[0].startCharIndex + 17)).toBe('Middle paragraph.');
    });
  });

  describe('return value structure', () => {
    it('returns array sorted by startCharIndex', () => {
      const content = 'First.\n\nSecond.\n\nThird.';
      const result = parseParagraphs(content);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].startCharIndex).toBeGreaterThan(result[i - 1].startCharIndex);
      }
    });
  });
});
