export interface TranscriptEntry {
  type: 'word' | 'command';
  text: string;
}

export function formatTranscript(entries: TranscriptEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  const parts: string[] = [];
  let currentWords: string[] = [];

  for (const entry of entries) {
    if (entry.type === 'word') {
      currentWords.push(entry.text);
    } else {
      if (currentWords.length > 0) {
        parts.push(currentWords.join(' '));
        currentWords = [];
      }
      parts.push(entry.text);
    }
  }

  if (currentWords.length > 0) {
    parts.push(currentWords.join(' '));
  }

  return parts.join('\n\n');
}

export function generateTranscriptPath(scriptPath: string, startTime: Date): string {
  const year = startTime.getFullYear();
  const month = String(startTime.getMonth() + 1).padStart(2, '0');
  const day = String(startTime.getDate()).padStart(2, '0');
  const hours = String(startTime.getHours()).padStart(2, '0');
  const minutes = String(startTime.getMinutes()).padStart(2, '0');
  const seconds = String(startTime.getSeconds()).padStart(2, '0');

  const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

  const lastDotIndex = scriptPath.lastIndexOf('.');
  const lastSlashIndex = Math.max(scriptPath.lastIndexOf('/'), scriptPath.lastIndexOf('\\'));

  const hasExtension = lastDotIndex > lastSlashIndex && lastDotIndex !== -1;

  if (hasExtension) {
    const basePath = scriptPath.slice(0, lastDotIndex);
    return `${basePath}.transcript.${timestamp}.md`;
  }

  return `${scriptPath}.transcript.${timestamp}.md`;
}
