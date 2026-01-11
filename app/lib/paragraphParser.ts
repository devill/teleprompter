export interface ParagraphAnchor {
  startCharIndex: number;
}

export function parseParagraphs(content: string): ParagraphAnchor[] {
  if (content.trim().length === 0) {
    return [];
  }

  const anchors: ParagraphAnchor[] = [];
  let position = 0;

  // Split by blank lines (two or more consecutive newlines)
  const parts = content.split(/\n\n+/);

  for (const part of parts) {
    if (part.trim().length === 0) {
      position = content.indexOf('\n\n', position) + 2;
      continue;
    }

    const startIndex = content.indexOf(part, position);
    anchors.push({ startCharIndex: startIndex });
    position = startIndex + part.length;
  }

  return anchors;
}
