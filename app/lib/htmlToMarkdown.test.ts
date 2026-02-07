import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from './htmlToMarkdown';

describe('htmlToMarkdown', () => {
  describe('headings', () => {
    it('converts h1 to markdown heading', () => {
      const html = '<h1>Introduction</h1>';
      expect(htmlToMarkdown(html)).toBe('# Introduction');
    });

    it('converts h2 to markdown heading', () => {
      const html = '<h2>Chapter One</h2>';
      expect(htmlToMarkdown(html)).toBe('## Chapter One');
    });

    it('converts h3 to h6 with correct hash count', () => {
      expect(htmlToMarkdown('<h3>Level 3</h3>')).toBe('### Level 3');
      expect(htmlToMarkdown('<h4>Level 4</h4>')).toBe('#### Level 4');
      expect(htmlToMarkdown('<h5>Level 5</h5>')).toBe('##### Level 5');
      expect(htmlToMarkdown('<h6>Level 6</h6>')).toBe('###### Level 6');
    });

    it('preserves heading text with nested formatting', () => {
      const html = '<h1><strong>Bold</strong> and <em>italic</em> heading</h1>';
      expect(htmlToMarkdown(html)).toBe('# Bold and italic heading');
    });
  });

  describe('paragraphs and text', () => {
    it('extracts plain text from paragraphs', () => {
      const html = '<p>This is a paragraph.</p>';
      expect(htmlToMarkdown(html)).toBe('This is a paragraph.');
    });

    it('preserves multiple paragraphs with line breaks', () => {
      const html = '<p>First paragraph.</p><p>Second paragraph.</p>';
      expect(htmlToMarkdown(html)).toBe('First paragraph.\n\nSecond paragraph.');
    });

    it('strips inline formatting but keeps text', () => {
      const html = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
      expect(htmlToMarkdown(html)).toBe('This is bold and italic text.');
    });
  });

  describe('mixed content', () => {
    it('converts document with headings and paragraphs', () => {
      const html = `
        <h1>Title</h1>
        <p>Introduction text.</p>
        <h2>Section One</h2>
        <p>Content of section one.</p>
      `;
      const expected = `# Title

Introduction text.

## Section One

Content of section one.`;
      expect(htmlToMarkdown(html)).toBe(expected);
    });

    it('handles Google Docs style HTML', () => {
      const html = `
        <h1 style="font-size:24px;color:#333">My Document</h1>
        <p style="margin:10px">Some text here.</p>
        <h2 style="font-size:18px">Section</h2>
        <p>More content.</p>
      `;
      const result = htmlToMarkdown(html);
      expect(result).toContain('# My Document');
      expect(result).toContain('## Section');
      expect(result).toContain('Some text here.');
    });

    it('handles Word-style HTML with spans', () => {
      const html = `
        <h1><span style="font-family:Arial">Document Title</span></h1>
        <p><span>Paragraph with spans.</span></p>
      `;
      const result = htmlToMarkdown(html);
      expect(result).toContain('# Document Title');
      expect(result).toContain('Paragraph with spans.');
    });
  });

  describe('lists', () => {
    it('extracts text from list items', () => {
      const html = '<ul><li>Item one</li><li>Item two</li></ul>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('Item one');
      expect(result).toContain('Item two');
    });
  });

  describe('whitespace handling', () => {
    it('removes excessive blank lines', () => {
      const html = '<p>First</p><p></p><p></p><p>Second</p>';
      const result = htmlToMarkdown(html);
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('trims whitespace from lines', () => {
      const html = '<p>   Padded text   </p>';
      expect(htmlToMarkdown(html)).toBe('Padded text');
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      expect(htmlToMarkdown('')).toBe('');
    });

    it('handles plain text without HTML', () => {
      expect(htmlToMarkdown('Just plain text')).toBe('Just plain text');
    });

    it('handles empty headings gracefully', () => {
      const html = '<h1></h1><p>Content</p>';
      expect(htmlToMarkdown(html)).toBe('Content');
    });
  });

});
