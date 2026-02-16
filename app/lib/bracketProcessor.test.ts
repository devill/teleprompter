import { describe, it, expect } from 'vitest';
import { processBrackets, ProcessedWord, ProcessedLine } from './bracketProcessor';

describe('processBrackets', () => {
  describe('no brackets', () => {
    it('returns passthrough for plain text with all words speakable', () => {
      const result = processBrackets('Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].originalText).toBe('Hello world');
      expect(result[0].displayText).toBe('Hello world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles empty string', () => {
      const result = processBrackets('');
      expect(result).toHaveLength(0);
    });

    it('handles multiple lines without brackets', () => {
      const result = processBrackets('Line one\nLine two');
      expect(result).toHaveLength(2);
      expect(result[0].displayText).toBe('Line one');
      expect(result[1].displayText).toBe('Line two');
    });
  });

  describe('square brackets [removed]', () => {
    it('removes square brackets and content from display', () => {
      const result = processBrackets('Hello [direction] world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('removes square brackets at start of line', () => {
      const result = processBrackets('[stage direction] Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('removes square brackets at end of line', () => {
      const result = processBrackets('Hello world [exit]');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles line with only square brackets', () => {
      const result = processBrackets('[stage direction]');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('');
      expect(result[0].words).toEqual([]);
    });

    it('handles empty square brackets', () => {
      const result = processBrackets('Hello [] world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles consecutive square brackets', () => {
      const result = processBrackets('[one][two] Hello');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
      ]);
    });
  });

  describe('curly brackets {visible but not speakable}', () => {
    it('shows curly bracket content in display but marks as not speakable', () => {
      const result = processBrackets('Hello {aside} world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello aside world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'aside', speakable: false },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles multi-word curly bracket content', () => {
      const result = processBrackets('Hello {pause here} world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello pause here world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'pause', speakable: false },
        { text: 'here', speakable: false },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles curly brackets at start of line', () => {
      const result = processBrackets('{whisper} Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('whisper Hello world');
      expect(result[0].words).toEqual([
        { text: 'whisper', speakable: false },
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles curly brackets at end of line', () => {
      const result = processBrackets('Hello world {end}');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello world end');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
        { text: 'end', speakable: false },
      ]);
    });

    it('handles empty curly brackets', () => {
      const result = processBrackets('Hello {} world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });
  });

  describe('multiple brackets per line', () => {
    it('handles multiple square brackets', () => {
      const result = processBrackets('Hello [dir1] middle [dir2] world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello middle world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'middle', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles multiple curly brackets', () => {
      const result = processBrackets('Hello {aside1} middle {aside2} world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello aside1 middle aside2 world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'aside1', speakable: false },
        { text: 'middle', speakable: true },
        { text: 'aside2', speakable: false },
        { text: 'world', speakable: true },
      ]);
    });

    it('handles mixed square and curly brackets', () => {
      const result = processBrackets('Hello [direction] {aside} world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello aside world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'aside', speakable: false },
        { text: 'world', speakable: true },
      ]);
    });
  });

  describe('nested brackets', () => {
    it('outer square bracket removes everything including nested curly', () => {
      const result = processBrackets('Hello [outer {nested}] world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('outer curly bracket makes everything inside not speakable', () => {
      const result = processBrackets('Hello {outer [nested]} world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello outer [nested] world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'outer', speakable: false },
        { text: '[nested]', speakable: false },
        { text: 'world', speakable: true },
      ]);
    });
  });

  describe('unclosed brackets', () => {
    it('treats unclosed square bracket as literal text', () => {
      const result = processBrackets('Hello [unclosed world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello [unclosed world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: '[unclosed', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('treats unclosed curly bracket as literal text', () => {
      const result = processBrackets('Hello {unclosed world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello {unclosed world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: '{unclosed', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });

    it('treats unopened closing brackets as literal', () => {
      const result = processBrackets('Hello unclosed] world');
      expect(result).toHaveLength(1);
      expect(result[0].displayText).toBe('Hello unclosed] world');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: 'unclosed]', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });
  });

  describe('brackets do not span lines', () => {
    it('unclosed bracket on first line treated as literal', () => {
      const result = processBrackets('Hello [start\nend] world');
      expect(result).toHaveLength(2);
      expect(result[0].displayText).toBe('Hello [start');
      expect(result[0].words).toEqual([
        { text: 'Hello', speakable: true },
        { text: '[start', speakable: true },
      ]);
      expect(result[1].displayText).toBe('end] world');
      expect(result[1].words).toEqual([
        { text: 'end]', speakable: true },
        { text: 'world', speakable: true },
      ]);
    });
  });

  describe('preserves original text', () => {
    it('originalText contains unprocessed line content', () => {
      const result = processBrackets('Hello [direction] {aside} world');
      expect(result).toHaveLength(1);
      expect(result[0].originalText).toBe('Hello [direction] {aside} world');
    });
  });
});
