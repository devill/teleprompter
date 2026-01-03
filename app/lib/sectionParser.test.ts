import { describe, it, expect } from 'vitest';
import { parseSections } from './sectionParser';

describe('parseSections', () => {
  describe('empty and no-section content', () => {
    it('returns empty array for empty string', () => {
      expect(parseSections('')).toEqual([]);
    });

    it('returns empty array for content without sections', () => {
      const content = 'Just some plain text without any headings or numbered sections.';
      expect(parseSections(content)).toEqual([]);
    });
  });

  describe('heading detection', () => {
    it('detects h1 heading', () => {
      const content = '# Main Title';
      const sections = parseSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('heading');
      expect(sections[0].level).toBe(1);
      expect(sections[0].text).toBe('Main Title');
      expect(sections[0].charIndex).toBe(0);
    });

    it('detects h2 through h6 headings', () => {
      const content = `## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6`;
      const sections = parseSections(content);

      expect(sections).toHaveLength(5);
      expect(sections[0].level).toBe(2);
      expect(sections[1].level).toBe(3);
      expect(sections[2].level).toBe(4);
      expect(sections[3].level).toBe(5);
      expect(sections[4].level).toBe(6);
    });

    it('extracts heading text without hash symbols', () => {
      const content = '### My Heading Text';
      const sections = parseSections(content);

      expect(sections[0].text).toBe('My Heading Text');
    });

    it('normalizes heading text', () => {
      const content = '# Hello, World!';
      const sections = parseSections(content);

      expect(sections[0].normalizedText).toBe('hello world');
    });

    it('extracts keywords from heading', () => {
      const content = '# Introduction to Programming';
      const sections = parseSections(content);

      expect(sections[0].keywords).toContain('introduction');
      expect(sections[0].keywords).toContain('to');
      expect(sections[0].keywords).toContain('programming');
    });

    it('generates unique id for each heading', () => {
      const content = `# First
## Second`;
      const sections = parseSections(content);

      expect(sections[0].id).toBeTruthy();
      expect(sections[1].id).toBeTruthy();
      expect(sections[0].id).not.toBe(sections[1].id);
    });

    it('calculates correct character indices', () => {
      const content = `Some intro text.

# First Heading

More text here.

## Second Heading`;
      const sections = parseSections(content);

      expect(sections).toHaveLength(2);
      expect(content.slice(sections[0].charIndex, sections[0].charIndex + 15)).toBe('# First Heading');
      expect(content.slice(sections[1].charIndex, sections[1].charIndex + 17)).toBe('## Second Heading');
    });
  });

  describe('numbered patterns', () => {
    it('detects Lesson pattern', () => {
      const content = 'Welcome to Lesson 5 of the course.';
      const sections = parseSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('numbered');
      expect(sections[0].text).toBe('Lesson 5');
    });

    it('detects Chapter pattern', () => {
      const content = 'Start reading Chapter 12 now.';
      const sections = parseSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('numbered');
      expect(sections[0].text).toBe('Chapter 12');
    });

    it('is case insensitive for Lesson and Chapter', () => {
      const content = 'lesson 1 and CHAPTER 2 and Lesson 3';
      const sections = parseSections(content);

      expect(sections).toHaveLength(3);
    });

    it('includes number word variants in keywords', () => {
      const content = 'Lesson 5';
      const sections = parseSections(content);

      expect(sections[0].keywords).toContain('5');
      expect(sections[0].keywords).toContain('five');
      expect(sections[0].keywords).toContain('lesson');
    });

    it('sets level to 0 for numbered patterns', () => {
      const content = 'Chapter 7';
      const sections = parseSections(content);

      expect(sections[0].level).toBe(0);
    });
  });

  describe('headings with numbers', () => {
    it('extracts number variants from headings', () => {
      const content = '# Chapter 3: Getting Started';
      const sections = parseSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].keywords).toContain('3');
      expect(sections[0].keywords).toContain('three');
    });

    it('handles heading that contains Lesson pattern', () => {
      const content = '## Lesson 10: Advanced Topics';
      const sections = parseSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('heading');
      expect(sections[0].keywords).toContain('10');
      expect(sections[0].keywords).toContain('ten');
    });
  });

  describe('mixed content', () => {
    it('finds both headings and numbered patterns', () => {
      const content = `# Introduction

This is Lesson 1 content.

## Summary`;
      const sections = parseSections(content);

      expect(sections).toHaveLength(3);
      expect(sections[0].type).toBe('heading');
      expect(sections[0].text).toBe('Introduction');
      expect(sections[1].type).toBe('numbered');
      expect(sections[1].text).toBe('Lesson 1');
      expect(sections[2].type).toBe('heading');
      expect(sections[2].text).toBe('Summary');
    });

    it('returns sections sorted by character index', () => {
      const content = `Chapter 2 comes first.

# Middle Heading

Then Lesson 3 at the end.`;
      const sections = parseSections(content);

      expect(sections.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < sections.length; i++) {
        expect(sections[i].charIndex).toBeGreaterThan(sections[i - 1].charIndex);
      }
    });

    it('handles multiple numbered patterns in same document', () => {
      const content = `Lesson 1

Lesson 2

Lesson 3`;
      const sections = parseSections(content);

      expect(sections).toHaveLength(3);
      expect(sections[0].text).toBe('Lesson 1');
      expect(sections[1].text).toBe('Lesson 2');
      expect(sections[2].text).toBe('Lesson 3');
    });
  });

  describe('edge cases', () => {
    it('ignores lines starting with hash without space', () => {
      const content = '#hashtag is not a heading';
      const sections = parseSections(content);

      expect(sections).toEqual([]);
    });

    it('handles heading with only numbers', () => {
      const content = '# 2024';
      const sections = parseSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].text).toBe('2024');
    });

    it('handles Lesson/Chapter with large numbers', () => {
      const content = 'Lesson 100';
      const sections = parseSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].keywords).toContain('100');
      expect(sections[0].keywords).toContain('lesson');
    });
  });
});
