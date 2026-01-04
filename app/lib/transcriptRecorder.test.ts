import { describe, it, expect } from 'vitest';
import {
  formatTranscript,
  generateTranscriptPath,
  TranscriptEntry,
} from './transcriptRecorder';

describe('formatTranscript', () => {
  it('returns empty string for empty array', () => {
    expect(formatTranscript([])).toBe('');
  });

  it('joins word entries with spaces', () => {
    const entries: TranscriptEntry[] = [
      { type: 'word', text: 'hello' },
      { type: 'word', text: 'world' },
    ];
    expect(formatTranscript(entries)).toBe('hello world');
  });

  it('inserts command on its own line with blank lines around it', () => {
    const entries: TranscriptEntry[] = [
      { type: 'word', text: 'hello' },
      { type: 'word', text: 'world' },
      { type: 'command', text: 'please jump back 2 blocks' },
      { type: 'word', text: 'continuing' },
    ];
    expect(formatTranscript(entries)).toBe(
      'hello world\n\nplease jump back 2 blocks\n\ncontinuing'
    );
  });

  it('handles multiple consecutive commands', () => {
    const entries: TranscriptEntry[] = [
      { type: 'word', text: 'hello' },
      { type: 'command', text: 'command one' },
      { type: 'command', text: 'command two' },
      { type: 'word', text: 'world' },
    ];
    expect(formatTranscript(entries)).toBe(
      'hello\n\ncommand one\n\ncommand two\n\nworld'
    );
  });

  it('handles command at start of transcript', () => {
    const entries: TranscriptEntry[] = [
      { type: 'command', text: 'initial command' },
      { type: 'word', text: 'hello' },
      { type: 'word', text: 'world' },
    ];
    expect(formatTranscript(entries)).toBe('initial command\n\nhello world');
  });

  it('handles command at end of transcript', () => {
    const entries: TranscriptEntry[] = [
      { type: 'word', text: 'hello' },
      { type: 'word', text: 'world' },
      { type: 'command', text: 'final command' },
    ];
    expect(formatTranscript(entries)).toBe('hello world\n\nfinal command');
  });

  it('handles only commands', () => {
    const entries: TranscriptEntry[] = [
      { type: 'command', text: 'command one' },
      { type: 'command', text: 'command two' },
    ];
    expect(formatTranscript(entries)).toBe('command one\n\ncommand two');
  });

  it('handles only words', () => {
    const entries: TranscriptEntry[] = [
      { type: 'word', text: 'one' },
      { type: 'word', text: 'two' },
      { type: 'word', text: 'three' },
    ];
    expect(formatTranscript(entries)).toBe('one two three');
  });
});

describe('generateTranscriptPath', () => {
  it('converts script.md to timestamped transcript path', () => {
    const startTime = new Date('2026-01-04T20:30:13');
    expect(generateTranscriptPath('script.md', startTime)).toBe(
      'script.transcript.2026-01-04_20-30-13.md'
    );
  });

  it('handles paths with directories', () => {
    const startTime = new Date('2026-01-04T20:30:13');
    expect(generateTranscriptPath('/path/to/script.md', startTime)).toBe(
      '/path/to/script.transcript.2026-01-04_20-30-13.md'
    );
  });

  it('handles files without extension', () => {
    const startTime = new Date('2026-01-04T20:30:13');
    expect(generateTranscriptPath('script', startTime)).toBe(
      'script.transcript.2026-01-04_20-30-13.md'
    );
  });

  it('handles files with multiple dots', () => {
    const startTime = new Date('2026-01-04T20:30:13');
    expect(generateTranscriptPath('my.script.md', startTime)).toBe(
      'my.script.transcript.2026-01-04_20-30-13.md'
    );
  });

  it('pads single digit date/time components with zeros', () => {
    const startTime = new Date('2026-03-05T09:05:03');
    expect(generateTranscriptPath('script.md', startTime)).toBe(
      'script.transcript.2026-03-05_09-05-03.md'
    );
  });
});
