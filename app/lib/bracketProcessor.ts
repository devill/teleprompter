export interface ProcessedWord {
  text: string;
  speakable: boolean;
}

export interface ProcessedLine {
  originalText: string;
  displayText: string;
  words: ProcessedWord[];
}

function extractWords(text: string): string[] {
  return text.split(/\s+/).filter(word => word.length > 0);
}

function processLine(line: string): ProcessedLine {
  const words: ProcessedWord[] = [];
  let displayText = '';
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '[') {
      const closeIndex = line.indexOf(']', i + 1);
      if (closeIndex === -1) {
        // Unclosed bracket - treat as literal text until end of line
        const literalText = line.slice(i);
        displayText += literalText;
        const literalWords = extractWords(literalText);
        for (const word of literalWords) {
          words.push({ text: word, speakable: true });
        }
        break;
      }
      // Skip everything inside square brackets (removed from display)
      i = closeIndex + 1;
    } else if (char === '{') {
      const closeIndex = line.indexOf('}', i + 1);
      if (closeIndex === -1) {
        // Unclosed bracket - treat as literal text until end of line
        const literalText = line.slice(i);
        displayText += literalText;
        const literalWords = extractWords(literalText);
        for (const word of literalWords) {
          words.push({ text: word, speakable: true });
        }
        break;
      }
      // Content inside curly brackets is visible but not speakable
      const content = line.slice(i + 1, closeIndex);
      if (content.length > 0) {
        displayText += content;
        const contentWords = extractWords(content);
        for (const word of contentWords) {
          words.push({ text: word, speakable: false });
        }
      }
      i = closeIndex + 1;
    } else {
      // Regular character - find next bracket or end
      let nextBracket = line.length;
      const nextSquare = line.indexOf('[', i);
      const nextCurly = line.indexOf('{', i);
      if (nextSquare !== -1) nextBracket = Math.min(nextBracket, nextSquare);
      if (nextCurly !== -1) nextBracket = Math.min(nextBracket, nextCurly);

      const textSegment = line.slice(i, nextBracket);
      displayText += textSegment;
      const segmentWords = extractWords(textSegment);
      for (const word of segmentWords) {
        words.push({ text: word, speakable: true });
      }
      i = nextBracket;
    }
  }

  return {
    originalText: line,
    displayText: displayText.replace(/\s+/g, ' ').trim(),
    words,
  };
}

export function processBrackets(content: string): ProcessedLine[] {
  if (content === '') {
    return [];
  }

  const lines = content.split('\n');
  return lines.map(processLine);
}
