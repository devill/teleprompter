// Region in raw content (WITH markers)
export interface RawCommentRegion {
  commentId: string;
  startMarkerIndex: number;  // Where [[c:id]] starts
  endMarkerIndex: number;    // Where [[/c]] ends (after the marker)
  innerStartIndex: number;   // Where text content starts (after [[c:id]])
  innerEndIndex: number;     // Where text content ends (before [[/c]])
  selectedText: string;      // The text between markers
}

// Region in stripped content (WITHOUT markers)
export interface StrippedCommentRegion {
  commentId: string;
  start: number;      // Start index in stripped content
  end: number;        // End index in stripped content
  selectedText: string;
}

const MARKER_PATTERN_SOURCE = '\\[\\[c:([a-f0-9-]+)\\]\\]([\\s\\S]*?)\\[\\[\\/c\\]\\]';

function createMarkerRegex(): RegExp {
  return new RegExp(MARKER_PATTERN_SOURCE, 'g');
}

export function parseCommentMarkers(rawContent: string): RawCommentRegion[] {
  const regions: RawCommentRegion[] = [];
  const regex = createMarkerRegex();

  let match;
  while ((match = regex.exec(rawContent)) !== null) {
    const commentId = match[1];
    const selectedText = match[2];
    const startMarkerIndex = match.index;
    const fullMatch = match[0];
    const endMarkerIndex = startMarkerIndex + fullMatch.length;

    // Calculate inner indices
    // Start marker is [[c:uuid]] so inner starts after that
    const startMarker = `[[c:${commentId}]]`;
    const innerStartIndex = startMarkerIndex + startMarker.length;
    const innerEndIndex = endMarkerIndex - '[[/c]]'.length;

    regions.push({
      commentId,
      startMarkerIndex,
      endMarkerIndex,
      innerStartIndex,
      innerEndIndex,
      selectedText,
    });
  }

  return regions;
}

export function stripMarkers(rawContent: string): string {
  return rawContent.replace(createMarkerRegex(), '$2');
}

export function getStrippedRegions(rawContent: string): StrippedCommentRegion[] {
  const rawRegions = parseCommentMarkers(rawContent);
  const strippedRegions: StrippedCommentRegion[] = [];

  // Track cumulative offset as we process markers in order
  let cumulativeOffset = 0;

  for (const region of rawRegions) {
    const startMarker = `[[c:${region.commentId}]]`;
    const endMarker = '[[/c]]';

    // In stripped content, the start position is the raw start minus all previous marker characters
    const strippedStart = region.innerStartIndex - cumulativeOffset - startMarker.length;
    const strippedEnd = strippedStart + region.selectedText.length;

    strippedRegions.push({
      commentId: region.commentId,
      start: strippedStart,
      end: strippedEnd,
      selectedText: region.selectedText,
    });

    // Add the markers we just processed to the cumulative offset
    cumulativeOffset += startMarker.length + endMarker.length;
  }

  return strippedRegions;
}

export function insertCommentMarkers(
  rawContent: string,
  startIndex: number,
  endIndex: number,
  commentId: string
): string {
  const startMarker = `[[c:${commentId}]]`;
  const endMarker = '[[/c]]';

  return (
    rawContent.slice(0, startIndex) +
    startMarker +
    rawContent.slice(startIndex, endIndex) +
    endMarker +
    rawContent.slice(endIndex)
  );
}

export function removeCommentMarkers(rawContent: string, commentId: string): string {
  // Build a specific pattern for this comment ID
  const specificPattern = new RegExp(
    `\\[\\[c:${commentId}\\]\\]([\\s\\S]*?)\\[\\[\\/c\\]\\]`,
    'g'
  );
  return rawContent.replace(specificPattern, '$1');
}
