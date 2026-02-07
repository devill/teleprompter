/**
 * Converts HTML to markdown, preserving only heading structure.
 * All other formatting is stripped, keeping plain text.
 */
export function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  return processNode(doc.body);
}

function processNode(node: Node): string {
  const parts: string[] = [];

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text.trim()) {
        parts.push(text);
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tagName = element.tagName.toLowerCase();

      // Convert heading tags to markdown
      if (/^h[1-6]$/.test(tagName)) {
        const level = parseInt(tagName[1], 10);
        const hashes = '#'.repeat(level);
        const content = getTextContent(element).trim();
        if (content) {
          parts.push(`\n${hashes} ${content}\n`);
        }
      }
      // Block elements that should create line breaks
      else if (isBlockElement(tagName)) {
        const content = processNode(element);
        if (content.trim()) {
          parts.push(`\n${content}\n`);
        }
      }
      // Inline elements - just get their content
      else {
        parts.push(processNode(element));
      }
    }
  }

  return cleanupWhitespace(parts.join(''));
}

function getTextContent(element: Element): string {
  // Get text content, but handle nested elements
  return processNode(element);
}

function isBlockElement(tagName: string): boolean {
  const blockElements = [
    'p', 'div', 'section', 'article', 'header', 'footer',
    'li', 'ul', 'ol', 'blockquote', 'pre', 'table', 'tr',
    'br', 'hr'
  ];
  return blockElements.includes(tagName);
}

function cleanupWhitespace(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove excessive blank lines (more than 2 consecutive)
    .replace(/\n{3,}/g, '\n\n')
    // Trim leading/trailing whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Trim the whole text
    .trim();
}
