import { describe, it, expect } from 'vitest';
import { generateUniqueScriptName, extractTitleFromContent, makeNameUnique } from './scriptNaming';

describe('generateUniqueScriptName', () => {
  it('returns "Untitled Script" when list is empty', () => {
    expect(generateUniqueScriptName([])).toBe('Untitled Script');
  });

  it('returns "Untitled Script 2" when "Untitled Script" exists', () => {
    expect(generateUniqueScriptName(['Untitled Script'])).toBe('Untitled Script 2');
  });

  it('returns "Untitled Script 3" when first two exist', () => {
    const existingNames = ['Untitled Script', 'Untitled Script 2'];
    expect(generateUniqueScriptName(existingNames)).toBe('Untitled Script 3');
  });

  it('fills gaps in numbering', () => {
    const existingNames = ['Untitled Script', 'Untitled Script 3'];
    expect(generateUniqueScriptName(existingNames)).toBe('Untitled Script 2');
  });
});

describe('extractTitleFromContent', () => {
  it('returns first line as title', () => {
    expect(extractTitleFromContent('TUNNELBAHN FLEISSALM SCRIPT\n\nHello world')).toBe('TUNNELBAHN FLEISSALM SCRIPT');
  });

  it('strips markdown heading markers', () => {
    expect(extractTitleFromContent('# My Great Speech\n\nContent here')).toBe('My Great Speech');
    expect(extractTitleFromContent('## Section Title\n\nMore content')).toBe('Section Title');
  });

  it('skips empty lines to find title', () => {
    expect(extractTitleFromContent('\n\n  \nActual Title\nContent')).toBe('Actual Title');
  });

  it('returns "Untitled Script" for empty content', () => {
    expect(extractTitleFromContent('')).toBe('Untitled Script');
    expect(extractTitleFromContent('   \n  \n  ')).toBe('Untitled Script');
  });

  it('truncates long titles with ellipsis', () => {
    const longTitle = 'This is a very long title that exceeds the maximum length allowed for script names';
    const result = extractTitleFromContent(longTitle);
    expect(result.length).toBeLessThanOrEqual(51); // 50 + ellipsis
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('makeNameUnique', () => {
  it('returns base name when not in list', () => {
    expect(makeNameUnique('My Script', [])).toBe('My Script');
    expect(makeNameUnique('My Script', ['Other Script'])).toBe('My Script');
  });

  it('adds number suffix when name exists', () => {
    expect(makeNameUnique('My Script', ['My Script'])).toBe('My Script 2');
  });

  it('increments number for multiple conflicts', () => {
    expect(makeNameUnique('My Script', ['My Script', 'My Script 2'])).toBe('My Script 3');
  });

  it('fills gaps in numbering', () => {
    expect(makeNameUnique('My Script', ['My Script', 'My Script 3'])).toBe('My Script 2');
  });
});
