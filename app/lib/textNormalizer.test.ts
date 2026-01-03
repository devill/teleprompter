import { describe, it, expect } from 'vitest';
import { normalizeText, tokenize, normalizeNumber } from './textNormalizer';

describe('normalizeText', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeText('')).toBe('');
  });

  it('converts text to lowercase', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
    expect(normalizeText('UPPERCASE')).toBe('uppercase');
  });

  it('removes punctuation except apostrophes', () => {
    expect(normalizeText('Hello, world!')).toBe('hello world');
    expect(normalizeText('What? Yes! No.')).toBe('what yes no');
    expect(normalizeText('test@email.com')).toBe('testemailcom');
  });

  it('preserves apostrophes', () => {
    expect(normalizeText("don't")).toBe("don't");
    expect(normalizeText("it's fine")).toBe("it's fine");
    expect(normalizeText("we're here")).toBe("we're here");
  });

  it('collapses multiple whitespace to single space', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
    expect(normalizeText('a  b   c    d')).toBe('a b c d');
  });

  it('handles tabs and newlines as whitespace', () => {
    expect(normalizeText('hello\tworld')).toBe('hello world');
    expect(normalizeText('hello\nworld')).toBe('hello world');
    expect(normalizeText('hello\t\n  world')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
    expect(normalizeText('   spaced out   ')).toBe('spaced out');
  });

  it('handles mixed cases', () => {
    expect(normalizeText("  Hello,  World!  It's a TEST.  ")).toBe("hello world it's a test");
  });
});

describe('tokenize', () => {
  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('\t\n')).toEqual([]);
  });

  it('splits text into individual words', () => {
    expect(tokenize('hello world')).toEqual(['hello', 'world']);
    expect(tokenize('one two three')).toEqual(['one', 'two', 'three']);
  });

  it('normalizes before splitting', () => {
    expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
    expect(tokenize('UPPER lower')).toEqual(['upper', 'lower']);
  });

  it('handles extra whitespace', () => {
    expect(tokenize('hello    world')).toEqual(['hello', 'world']);
    expect(tokenize('  spaced  out  ')).toEqual(['spaced', 'out']);
  });

  it('preserves apostrophes in tokens', () => {
    expect(tokenize("don't stop")).toEqual(["don't", 'stop']);
    expect(tokenize("it's we're they're")).toEqual(["it's", "we're", "they're"]);
  });

  it('returns single-element array for single word', () => {
    expect(tokenize('word')).toEqual(['word']);
    expect(tokenize('  word  ')).toEqual(['word']);
  });
});

describe('normalizeNumber', () => {
  it('converts digit to word (0-9)', () => {
    expect(normalizeNumber('0')).toBe('zero');
    expect(normalizeNumber('1')).toBe('one');
    expect(normalizeNumber('5')).toBe('five');
    expect(normalizeNumber('9')).toBe('nine');
  });

  it('converts teens to words (10-19)', () => {
    expect(normalizeNumber('10')).toBe('ten');
    expect(normalizeNumber('13')).toBe('thirteen');
    expect(normalizeNumber('19')).toBe('nineteen');
  });

  it('converts twenty', () => {
    expect(normalizeNumber('20')).toBe('twenty');
  });

  it('converts word to digit', () => {
    expect(normalizeNumber('zero')).toBe('0');
    expect(normalizeNumber('one')).toBe('1');
    expect(normalizeNumber('five')).toBe('5');
    expect(normalizeNumber('ten')).toBe('10');
    expect(normalizeNumber('twenty')).toBe('20');
  });

  it('handles case insensitivity for word to digit', () => {
    expect(normalizeNumber('ONE')).toBe('1');
    expect(normalizeNumber('Five')).toBe('5');
    expect(normalizeNumber('TEN')).toBe('10');
  });

  it('returns original text for unrecognized input', () => {
    expect(normalizeNumber('21')).toBe('21');
    expect(normalizeNumber('hundred')).toBe('hundred');
    expect(normalizeNumber('abc')).toBe('abc');
  });

  it('trims whitespace', () => {
    expect(normalizeNumber('  5  ')).toBe('five');
    expect(normalizeNumber('  five  ')).toBe('5');
  });
});
