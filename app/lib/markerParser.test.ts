import { describe, it, expect } from 'vitest';
import {
  parseCommentMarkers,
  stripMarkers,
  getStrippedRegions,
  insertCommentMarkers,
  removeCommentMarkers,
} from './markerParser';

describe('parseCommentMarkers', () => {
  it('returns empty array for empty string', () => {
    expect(parseCommentMarkers('')).toEqual([]);
  });

  it('returns empty array for content without markers', () => {
    expect(parseCommentMarkers('Hello world, no markers here.')).toEqual([]);
  });

  it('parses single marker correctly', () => {
    const content = 'Hello [[c:abc-123]]world[[/c]] today';
    const result = parseCommentMarkers(content);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      commentId: 'abc-123',
      startMarkerIndex: 6,
      endMarkerIndex: 30, // 6 + '[[c:abc-123]]world[[/c]]'.length = 6 + 24
      innerStartIndex: 19, // 6 + '[[c:abc-123]]'.length = 6 + 13
      innerEndIndex: 24, // 19 + 'world'.length = 19 + 5
      selectedText: 'world',
    });
  });

  it('parses multiple markers correctly', () => {
    const content = '[[c:a1]]first[[/c]] and [[c:b2]]second[[/c]]';
    const result = parseCommentMarkers(content);

    expect(result).toHaveLength(2);
    expect(result[0].commentId).toBe('a1');
    expect(result[0].selectedText).toBe('first');
    expect(result[1].commentId).toBe('b2');
    expect(result[1].selectedText).toBe('second');
  });

  it('handles multiline text within markers', () => {
    const content = '[[c:aaa-bbb]]line one\nline two\nline three[[/c]]';
    const result = parseCommentMarkers(content);

    expect(result).toHaveLength(1);
    expect(result[0].selectedText).toBe('line one\nline two\nline three');
  });

  it('handles standard UUID format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const content = `[[c:${uuid}]]text[[/c]]`;
    const result = parseCommentMarkers(content);

    expect(result).toHaveLength(1);
    expect(result[0].commentId).toBe(uuid);
  });

  it('calculates indices correctly', () => {
    const content = 'prefix[[c:abc-def]]marked text[[/c]]suffix';
    const result = parseCommentMarkers(content);

    expect(result[0].startMarkerIndex).toBe(6); // 'prefix' length
    expect(result[0].innerStartIndex).toBe(19); // after '[[c:abc-def]]' (6 + 13)
    expect(result[0].innerEndIndex).toBe(30); // before '[[/c]]' (19 + 11)
    expect(result[0].endMarkerIndex).toBe(36); // after '[[/c]]' (30 + 6)

    // Verify indices match expected substrings
    expect(content.slice(result[0].startMarkerIndex, result[0].endMarkerIndex))
      .toBe('[[c:abc-def]]marked text[[/c]]');
    expect(content.slice(result[0].innerStartIndex, result[0].innerEndIndex))
      .toBe('marked text');
  });
});

describe('stripMarkers', () => {
  it('returns empty string for empty input', () => {
    expect(stripMarkers('')).toBe('');
  });

  it('returns same content when no markers present', () => {
    const content = 'No markers here';
    expect(stripMarkers(content)).toBe(content);
  });

  it('removes markers and preserves text', () => {
    const content = 'Hello [[c:abc-123]]world[[/c]] today';
    expect(stripMarkers(content)).toBe('Hello world today');
  });

  it('removes multiple markers', () => {
    const content = '[[c:a]]one[[/c]] two [[c:b]]three[[/c]]';
    expect(stripMarkers(content)).toBe('one two three');
  });

  it('preserves multiline content', () => {
    const content = '[[c:1a]]line1\nline2[[/c]]';
    expect(stripMarkers(content)).toBe('line1\nline2');
  });
});

describe('getStrippedRegions', () => {
  it('returns empty array for empty string', () => {
    expect(getStrippedRegions('')).toEqual([]);
  });

  it('returns empty array for content without markers', () => {
    expect(getStrippedRegions('No markers here')).toEqual([]);
  });

  it('maps single marker position correctly', () => {
    const content = 'Hello [[c:a-1]]world[[/c]] today';
    const regions = getStrippedRegions(content);
    const stripped = stripMarkers(content); // 'Hello world today'

    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({
      commentId: 'a-1',
      start: 6, // 'Hello ' length
      end: 11, // 'Hello world'.length
      selectedText: 'world',
    });

    // Verify the indices correctly map to stripped content
    expect(stripped.slice(regions[0].start, regions[0].end)).toBe('world');
  });

  it('maps multiple markers with correct offset calculation', () => {
    const content = '[[c:a]]one[[/c]] two [[c:b]]three[[/c]]';
    const regions = getStrippedRegions(content);
    const stripped = stripMarkers(content); // 'one two three'

    expect(regions).toHaveLength(2);

    // First region
    expect(regions[0].commentId).toBe('a');
    expect(regions[0].start).toBe(0);
    expect(regions[0].end).toBe(3);
    expect(stripped.slice(regions[0].start, regions[0].end)).toBe('one');

    // Second region - position adjusted for removed markers
    expect(regions[1].commentId).toBe('b');
    expect(regions[1].start).toBe(8); // 'one two ' length
    expect(regions[1].end).toBe(13); // 'one two three'.length
    expect(stripped.slice(regions[1].start, regions[1].end)).toBe('three');
  });

  it('handles adjacent markers correctly', () => {
    const content = '[[c:a]]first[[/c]][[c:b]]second[[/c]]';
    const regions = getStrippedRegions(content);
    const stripped = stripMarkers(content); // 'firstsecond'

    expect(regions).toHaveLength(2);
    expect(stripped.slice(regions[0].start, regions[0].end)).toBe('first');
    expect(stripped.slice(regions[1].start, regions[1].end)).toBe('second');
  });
});

describe('insertCommentMarkers', () => {
  it('inserts markers at the beginning', () => {
    const content = 'Hello world';
    const result = insertCommentMarkers(content, 0, 5, 'test-id');
    expect(result).toBe('[[c:test-id]]Hello[[/c]] world');
  });

  it('inserts markers in the middle', () => {
    const content = 'Hello world today';
    const result = insertCommentMarkers(content, 6, 11, 'mid-id');
    expect(result).toBe('Hello [[c:mid-id]]world[[/c]] today');
  });

  it('inserts markers at the end', () => {
    const content = 'Hello world';
    const result = insertCommentMarkers(content, 6, 11, 'end-id');
    expect(result).toBe('Hello [[c:end-id]]world[[/c]]');
  });

  it('handles empty selection (insertion point)', () => {
    const content = 'Hello world';
    const result = insertCommentMarkers(content, 5, 5, 'empty-id');
    expect(result).toBe('Hello[[c:empty-id]][[/c]] world');
  });

  it('works with full UUID format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const content = 'test';
    const result = insertCommentMarkers(content, 0, 4, uuid);
    expect(result).toBe(`[[c:${uuid}]]test[[/c]]`);
  });
});

describe('removeCommentMarkers', () => {
  it('removes markers for specified comment ID', () => {
    const content = 'Hello [[c:remove-me]]world[[/c]] today';
    const result = removeCommentMarkers(content, 'remove-me');
    expect(result).toBe('Hello world today');
  });

  it('returns content unchanged when comment ID not found', () => {
    const content = 'Hello [[c:other-id]]world[[/c]] today';
    const result = removeCommentMarkers(content, 'non-existent');
    expect(result).toBe(content);
  });

  it('only removes markers for the specified ID', () => {
    const content = '[[c:keep]]one[[/c]] [[c:remove]]two[[/c]]';
    const result = removeCommentMarkers(content, 'remove');
    expect(result).toBe('[[c:keep]]one[[/c]] two');
  });

  it('removes all occurrences of the same ID', () => {
    const content = '[[c:dup]]first[[/c]] and [[c:dup]]second[[/c]]';
    const result = removeCommentMarkers(content, 'dup');
    expect(result).toBe('first and second');
  });

  it('handles multiline content within markers', () => {
    const content = '[[c:multi]]line1\nline2[[/c]]';
    const result = removeCommentMarkers(content, 'multi');
    expect(result).toBe('line1\nline2');
  });

  it('handles UUIDs with special regex characters safely', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const content = `[[c:${uuid}]]text[[/c]]`;
    const result = removeCommentMarkers(content, uuid);
    expect(result).toBe('text');
  });
});
