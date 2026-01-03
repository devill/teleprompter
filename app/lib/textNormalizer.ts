const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
  '11': 'eleven',
  '12': 'twelve',
  '13': 'thirteen',
  '14': 'fourteen',
  '15': 'fifteen',
  '16': 'sixteen',
  '17': 'seventeen',
  '18': 'eighteen',
  '19': 'nineteen',
  '20': 'twenty',
};

const WORD_TO_NUMBER: Record<string, string> = Object.fromEntries(
  Object.entries(NUMBER_WORDS).map(([num, word]) => [word, num])
);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  if (normalized === '') {
    return [];
  }
  return normalized.split(' ').filter(token => token !== '');
}

export function normalizeNumber(text: string): string {
  const trimmed = text.trim();

  if (NUMBER_WORDS[trimmed]) {
    return NUMBER_WORDS[trimmed];
  }

  const lowercased = trimmed.toLowerCase();
  if (WORD_TO_NUMBER[lowercased]) {
    return WORD_TO_NUMBER[lowercased];
  }

  return trimmed;
}
