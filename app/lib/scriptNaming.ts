const DEFAULT_NAME = 'Untitled Script';
const MAX_NAME_LENGTH = 50;

export function extractTitleFromContent(content: string): string {
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (!firstLine) {
    return DEFAULT_NAME;
  }

  // Strip markdown heading markers
  const title = firstLine.replace(/^#+\s*/, '').trim();

  if (!title) {
    return DEFAULT_NAME;
  }

  // Truncate if too long
  if (title.length > MAX_NAME_LENGTH) {
    return title.slice(0, MAX_NAME_LENGTH).trim() + '…';
  }

  return title;
}

export function makeNameUnique(baseName: string, existingNames: string[]): string {
  const nameSet = new Set(existingNames);

  if (!nameSet.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (nameSet.has(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}

export function generateUniqueScriptName(existingNames: string[]): string {
  return makeNameUnique(DEFAULT_NAME, existingNames);
}
